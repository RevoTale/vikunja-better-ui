package vikunja

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"image"
	_ "image/gif" // Register safe raster decoders for avatar dimension checks.
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// ErrInvalidAvatarUsername rejects names that cannot safely address an avatar.
var ErrInvalidAvatarUsername = errors.New("invalid avatar username")

const maxAvatarBytes = 128 * 1024
const avatarTimeout = 5 * time.Second

// Avatar returns a bounded raster data URL after validating the username and image dimensions.
func (client *Client) Avatar(ctx context.Context, username string) (result string, requestErr error) {
	if len(username) > 255 || strings.TrimSpace(username) == "" ||
		username == "." ||
		username == ".." ||
		strings.ContainsAny(username, "/\\?#%") ||
		!utf8.ValidString(username) ||
		strings.IndexFunc(username, unicode.IsControl) >= 0 {
		return "", ErrInvalidAvatarUsername
	}
	started := time.Now()
	defer func() { client.logRequest(ctx, http.MethodGet, "avatar", time.Since(started), requestErr) }()
	ctx, cancel := context.WithTimeout(ctx, avatarTimeout)
	defer cancel()
	request, err := client.newJSONRequest(
		ctx,
		http.MethodGet,
		"avatar/"+url.PathEscape(username),
		url.Values{"size": {"64"}},
		nil,
		"",
		"",
	)
	if err != nil {
		return "", err
	}
	request.Header.Set("Accept", "image/png,image/jpeg,image/gif")
	response, err := client.httpClient.Do(request)
	if err != nil {
		return "", err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return "", &Error{Status: response.StatusCode, Code: upstreamRejected}
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxAvatarBytes+1))
	if err != nil {
		return "", err
	}
	return avatarDataURL(body)
}

func avatarDataURL(body []byte) (string, error) {
	if len(body) > maxAvatarBytes {
		return "", ErrRejectedResponse
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(body))
	if err != nil || config.Width < 1 || config.Height < 1 || config.Width > 512 || config.Height > 512 {
		return "", ErrRejectedResponse
	}
	var mime string
	switch format {
	case "png":
		mime = "image/png"
	case "jpeg":
		mime = "image/jpeg"
	case "gif":
		mime = "image/gif"
	default:
		return "", ErrRejectedResponse
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(body), nil
}
