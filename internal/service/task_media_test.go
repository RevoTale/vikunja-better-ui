package service

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func TestUploadMediaRejectsUnsafeFilesBeforeUpstream(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name, body string
		size       int64
	}{
		{"fake.png", "<svg onload='alert(1)'/>", 25},
		{"empty.png", "", 0},
		{"large.png", "unused", MaxMediaBytes + 1},
		{"../file.png", "\x89PNG\r\n\x1a\n", 8},
		{"streaminfo-only.flac", "fLaC\x80\x00\x00\x22" + strings.Repeat("\x00", 34), 42},
	} {
		_, err := UploadTaskMedia(t.Context(), nil, 42, test.name, "", test.size, strings.NewReader(test.body))
		if !errors.Is(err, ErrInvalidMedia) {
			t.Errorf("%s: %v", test.name, err)
		}
	}
}

func TestUploadMediaRewindsFileAfterSniffing(t *testing.T) {
	t.Parallel()
	data := "\x89PNG\r\n\x1a\nimage payload"
	upstream := mediaUploadStub{t: t, want: data}
	attachment, err := UploadTaskMedia(
		t.Context(),
		upstream,
		42,
		"image.png",
		"image/png",
		int64(len(data)),
		strings.NewReader(data),
	)
	if err != nil || attachment.File.MIME != "image/png" {
		t.Fatalf("upload = %#v, %v", attachment, err)
	}
}

func TestMediaContentTypeValidatesSignaturesAndContainerFamilies(t *testing.T) {
	t.Parallel()
	flac := "fLaC\x00\x00\x00\x22" + strings.Repeat("\x00", 34)
	mp4 := "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"
	m4a := "\x00\x00\x00\x18ftypM4A \x00\x00\x00\x00M4A isom"
	for _, test := range []struct {
		name, body, declared, want string
	}{
		{"flac", flac, "audio/flac", "audio/flac"},
		{"upstream cannot classify final streaminfo", "fLaC\x80\x00\x00\x22" + strings.Repeat("\x00", 34), "audio/flac", ""},
		{"truncated flac", "fLaC\x00\x00\x00\x22", "audio/flac", ""},
		{"wrong flac metadata", "fLaC\x01\x00\x00\x22" + strings.Repeat("\x00", 34), "audio/flac", ""},
		{"untagged mp3", "\xff\xfb\x90\x00payload", "audio/mpeg", "audio/mpeg"},
		{"reserved mp3 version", "\xff\xeb\x90\x00", "audio/mpeg", ""},
		{"reserved mp3 bitrate", "\xff\xfb\xf0\x00", "audio/mpeg", ""},
		{"reserved mp3 sample rate", "\xff\xfb\x9c\x00", "audio/mpeg", ""},
		{"reserved mp3 emphasis", "\xff\xfb\x90\x02", "audio/mpeg", ""},
		{"mp4 audio", mp4, "audio/mp4", "audio/mp4"},
		{"mp4 video", mp4, "video/mp4", "video/mp4"},
		{"m4a audio brand", m4a, "audio/x-m4a", "audio/mp4"},
		{"webm audio", "\x1a\x45\xdf\xa3payload", "audio/webm", "audio/webm"},
		{"webm video", "\x1a\x45\xdf\xa3payload", "video/webm", "video/webm"},
		{"ogg video", "OggS\x00payload", "video/ogg", "video/ogg"},
		{"wave alias", "RIFF\x24\x00\x00\x00WAVEfmt ", "audio/wav", "audio/wav"},
		{"spoofed html", "<html>unsafe</html>", "image/png", ""},
		{"spoofed svg", "<svg onload='alert(1)'/>", "audio/webm", ""},
		{"unrelated declared family", "\x89PNG\r\n\x1a\n", "audio/webm", "image/png"},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := MediaContentType([]byte(test.body), test.declared); got != test.want {
				t.Fatalf("type = %q, want %q", got, test.want)
			}
		})
	}
}

func TestUploadMediaRetainsCompatibleUpstreamTypes(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name, body, declared, upstream, want string
	}{
		{"upstream audio webm", "\x1a\x45\xdf\xa3payload", "", "audio/webm", "audio/webm"},
		{"picker audio webm", "\x1a\x45\xdf\xa3payload", "audio/webm", "video/webm", "audio/webm"},
		{"upstream refines declared video", "\x1a\x45\xdf\xa3payload", "video/webm", "audio/webm", "audio/webm"},
		{"upstream m4a alias", "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom", "", "audio/x-m4a", "audio/mp4"},
		{"unrelated upstream type", "\x89PNG\r\n\x1a\n", "", "audio/webm", "image/png"},
	} {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			stub := mediaCountingStub{mime: test.upstream}
			got, err := UploadTaskMedia(
				t.Context(),
				&stub,
				42,
				"media.bin",
				test.declared,
				int64(len(test.body)),
				strings.NewReader(test.body),
			)
			if err != nil || got.File.MIME != test.want || stub.bytes != int64(len(test.body)) {
				t.Fatalf("upload = %#v, bytes %d, error %v", got, stub.bytes, err)
			}
		})
	}
}

func TestUploadMediaAcceptsExactSizeLimitAndRejectsExcess(t *testing.T) {
	t.Parallel()
	body := "\x89PNG\r\n\x1a\n" + strings.Repeat("\x00", int(MaxMediaBytes)-8)
	stub := mediaCountingStub{mime: "image/png"}
	_, err := UploadTaskMedia(t.Context(), &stub, 42, "image.png", "image/png", MaxMediaBytes, strings.NewReader(body))
	if err != nil || stub.bytes != MaxMediaBytes {
		t.Fatalf("exact limit: bytes %d, error %v", stub.bytes, err)
	}
	_, err = UploadTaskMedia(t.Context(), nil, 42, "image.png", "image/png", MaxMediaBytes+1, strings.NewReader(body))
	if !errors.Is(err, ErrInvalidMedia) {
		t.Fatalf("excess limit: %v", err)
	}
}

type mediaCountingStub struct {
	mime  string
	bytes int64
}

func (stub *mediaCountingStub) UploadTaskAttachment(
	_ context.Context, taskID int64, name string, file io.Reader,
) (vikunja.TaskAttachment, error) {
	n, err := io.Copy(io.Discard, file)
	stub.bytes = n
	return vikunja.TaskAttachment{
		ID:     8,
		TaskID: taskID,
		File:   vikunja.AttachmentFile{ID: 9, Name: name, MIME: stub.mime, Size: n},
	}, err
}

type mediaUploadStub struct {
	t    *testing.T
	want string
}

func (stub mediaUploadStub) UploadTaskAttachment(
	_ context.Context, id int64, name string, file io.Reader,
) (vikunja.TaskAttachment, error) {
	stub.t.Helper()
	body, err := io.ReadAll(file)
	if err != nil || string(body) != stub.want || id != 42 || name != "image.png" {
		stub.t.Fatalf("upstream received wrong file %q, %v", body, err)
	}
	return vikunja.TaskAttachment{
		ID:     8,
		TaskID: 42,
		File:   vikunja.AttachmentFile{ID: 9, Name: name, Size: int64(len(body))},
	}, nil
}
