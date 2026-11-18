package web

import (
	"net"
	"net/http"
	"net/netip"
	"net/url"
)

const (
	defaultHTTPPort  uint16 = 80
	defaultHTTPSPort uint16 = 443
)

// BrowserOrigin resolves the configured browser address or the directly contacted
// private listener. Proxies and port translations can supply a fixed origin in configuration.
func BrowserOrigin(fixed *url.URL, request *http.Request) *url.URL {
	if fixed != nil {
		return fixed
	}
	socket, ok := request.Context().Value(http.LocalAddrContextKey).(*net.TCPAddr)
	if !ok {
		return nil
	}
	address := socket.AddrPort()
	ip := address.Addr().Unmap()
	if !ip.IsPrivate() && !ip.IsLoopback() {
		return nil
	}
	scheme := "http"
	port := defaultHTTPPort
	if request.TLS != nil {
		scheme, port = "https", defaultHTTPSPort
	}
	host := netip.AddrPortFrom(ip, address.Port()).String()
	if address.Port() == port {
		host = ip.String()
		if ip.Is6() {
			host = "[" + host + "]"
		}
	}
	if request.Host != host {
		return nil
	}
	return &url.URL{Scheme: scheme, Host: host}
}
