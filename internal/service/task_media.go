package service

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"io"
	"mime"
	"net/http"
	"path"
	"strings"
	"unicode"

	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

const MaxMediaBytes int64 = 20 << 20

var ErrInvalidMedia = errors.New("media must be a supported image, audio or video file, at most 20 MiB")

type MediaUploader interface {
	UploadTaskAttachment(context.Context, int64, string, io.Reader) (vikunja.TaskAttachment, error)
}

func InlineMediaType(mime string) bool {
	switch mime {
	case "image/png", "image/jpeg", "image/gif", "image/webp", "audio/mpeg", "audio/wave", "audio/wav", "audio/x-wav", "audio/ogg", "application/ogg", "audio/flac", "audio/mp4", "audio/webm", "video/mp4", "video/webm", "video/ogg":
		return true
	default:
		return false
	}
}

func UploadTaskMedia(ctx context.Context, uploader MediaUploader, taskID int64, name, declaredType string, size int64, file io.ReadSeeker) (vikunja.TaskAttachment, error) {
	if taskID <= 0 || size <= 0 || size > MaxMediaBytes || !validMediaFilename(name) || file == nil {
		return vikunja.TaskAttachment{}, ErrInvalidMedia
	}
	var head [512]byte
	n, err := io.ReadFull(file, head[:])
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		return vikunja.TaskAttachment{}, ErrInvalidMedia
	}
	mediaType := MediaContentType(head[:n], declaredType)
	if mediaType == "" {
		return vikunja.TaskAttachment{}, ErrInvalidMedia
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return vikunja.TaskAttachment{}, err
	}
	attachment, err := uploader.UploadTaskAttachment(ctx, taskID, name, io.LimitReader(file, size))
	if err != nil {
		return vikunja.TaskAttachment{}, err
	}
	// Prefer Vikunja's more specific classification when the signature agrees.
	// A compatible picker type can refine its generic MP4/WebM classification.
	upstreamType := MediaContentType(head[:n], attachment.File.MIME)
	if upstreamType != MediaContentType(head[:n], "") {
		mediaType = upstreamType
	}
	attachment.File.MIME = mediaType
	return attachment, nil
}

// MediaContentType validates a signature before retaining a compatible declared
// type. It inspects at most the caller's 512-byte prefix, never the whole file.
func MediaContentType(head []byte, declaredType string) string {
	detected := http.DetectContentType(head)
	switch {
	case flacHeader(head):
		detected = "audio/flac"
	case mpegFrameHeader(head):
		detected = "audio/mpeg"
	case audioMP4Header(head):
		detected = "audio/mp4"
	}
	if !InlineMediaType(detected) {
		return ""
	}
	declared := AttachmentMediaType(declaredType, "")
	if compatibleMediaType(detected, declared) {
		return declared
	}
	return detected
}

// AttachmentMediaType normalizes Vikunja's supported aliases. Audio filename
// hints refine an already identified MP4/WebM container, never another type.
func AttachmentMediaType(value, filename string) string {
	mediaType, _, err := mime.ParseMediaType(value)
	if err != nil {
		return ""
	}
	switch mediaType {
	case "audio/x-m4a", "audio/x-mp4a":
		return "audio/mp4"
	case "video/mp4":
		if strings.EqualFold(path.Ext(filename), ".m4a") {
			return "audio/mp4"
		}
	case "video/webm":
		if strings.EqualFold(path.Ext(filename), ".weba") {
			return "audio/webm"
		}
	}
	return mediaType
}

func compatibleMediaType(detected, declared string) bool {
	if detected == declared {
		return true
	}
	switch detected {
	case "video/mp4":
		return declared == "audio/mp4"
	case "video/webm":
		return declared == "audio/webm"
	case "application/ogg":
		return declared == "audio/ogg" || declared == "video/ogg"
	case "audio/wave":
		return declared == "audio/wav" || declared == "audio/x-wav"
	default:
		return false
	}
}

func flacHeader(head []byte) bool {
	// Vikunja 2.5's MIME detector requires a non-final STREAMINFO block.
	// Reject the final-block variant before upload: it would persist as octet-
	// stream upstream and our safe media endpoint could not play it back.
	return len(head) >= 42 && bytes.Equal(head[:4], []byte("fLaC")) &&
		head[4] == 0 && head[5] == 0 && head[6] == 0 && head[7] == 34
}

func mpegFrameHeader(head []byte) bool {
	// Eleven sync bits, a defined MPEG version/layer, non-reserved bitrate,
	// sample rate and emphasis. Free-format bitrate is not detected here.
	return len(head) >= 4 && head[0] == 0xff && head[1]&0xe0 == 0xe0 &&
		head[1]&0x18 != 0x08 && head[1]&0x06 != 0 &&
		head[2]&0xf0 != 0 && head[2]&0xf0 != 0xf0 &&
		head[2]&0x0c != 0x0c && head[3]&0x03 != 0x02
}

func audioMP4Header(head []byte) bool {
	if len(head) < 16 || !bytes.Equal(head[4:8], []byte("ftyp")) {
		return false
	}
	boxSize := binary.BigEndian.Uint32(head[:4])
	if boxSize < 16 || boxSize%4 != 0 || uint64(boxSize) > uint64(len(head)) {
		return false
	}
	switch string(head[8:12]) {
	case "M4A ", "M4B ", "F4A ", "F4B ":
		return true
	default:
		return false
	}
}

func validMediaFilename(name string) bool {
	return name != "" && len(name) <= 255 && !strings.ContainsAny(name, "/\\") && strings.IndexFunc(name, unicode.IsControl) == -1
}
