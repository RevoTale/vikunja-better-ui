// Package config parses and validates the application's environment configuration.
package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
)

const (
	httpScheme                = "http"
	httpsScheme               = "https"
	minimumSessionSecretBytes = 32
)

// Environment selects production security requirements or isolated local operation.
type Environment string

// Supported application environments.
const (
	EnvironmentProduction  Environment = "production"
	EnvironmentDevelopment Environment = "development"
	EnvironmentTest        Environment = "test"
)

// LogLevel is a validated structured logging threshold.
type LogLevel string

// Supported logging thresholds, from most to least verbose.
const (
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

// Config contains validated server settings and backend-only credentials.
type Config struct {
	VikunjaURL            *url.URL
	VikunjaPublicURL      *url.URL
	VikunjaAPIToken       string
	AuthUsername          string
	AuthPassword          string
	SessionSecret         []byte
	HTTPAddr              string
	LogLevel              LogLevel
	Environment           Environment
	AllowedOrigin         *url.URL
	PublicActivityEnabled bool
	Use12HourTime         bool
}

// LookupFunc reads an environment variable without coupling validation to the process.
type LookupFunc func(string) (string, bool)

// Load validates configuration, returning safe errors that never include secret values.
func Load(lookup LookupFunc) (Config, error) {
	environment, err := parseEnvironment(valueOrDefault(lookup, "APP_ENV", string(EnvironmentProduction)))
	if err != nil {
		return Config{}, err
	}

	vikunjaURL, err := parseVikunjaURL(required(lookup, "APP_VIKUNJA_URL"), environment)
	if err != nil {
		return Config{}, err
	}

	allowedOrigin, err := parseAllowedOrigin(lookup, environment)
	if err != nil {
		return Config{}, err
	}

	sessionSecret, err := parseSessionSecret(required(lookup, "APP_SESSION_SECRET"))
	if err != nil {
		return Config{}, err
	}

	logLevel, err := parseLogLevel(valueOrDefault(lookup, "APP_LOG_LEVEL", string(LogLevelInfo)))
	if err != nil {
		return Config{}, err
	}

	httpAddr := valueOrDefault(lookup, "APP_HTTP_ADDR", ":8080")
	if err := validateHTTPAddr(httpAddr); err != nil {
		return Config{}, err
	}

	configuration := Config{
		VikunjaURL:      vikunjaURL,
		VikunjaAPIToken: required(lookup, "APP_VIKUNJA_API_TOKEN"),
		AuthUsername:    required(lookup, "APP_AUTH_USERNAME"),
		AuthPassword:    required(lookup, "APP_AUTH_PASSWORD"),
		SessionSecret:   sessionSecret,
		HTTPAddr:        httpAddr,
		LogLevel:        logLevel,
		Environment:     environment,
		AllowedOrigin:   allowedOrigin,
	}

	if err := validateRequired(configuration); err != nil {
		return Config{}, err
	}
	configuration.VikunjaPublicURL, err = parsePublicURL(lookup, environment, vikunjaURL)
	if err != nil {
		return Config{}, err
	}
	configuration.PublicActivityEnabled, err = parsePublicActivity(lookup)
	if err != nil {
		return Config{}, err
	}
	configuration.Use12HourTime, err = parseTimeFormat(lookup)
	if err != nil {
		return Config{}, err
	}

	return configuration, nil
}

func parseTimeFormat(lookup LookupFunc) (bool, error) {
	switch valueOrDefault(lookup, "APP_TIME_FORMAT", "24h") {
	case "24h":
		return false, nil
	case "12h":
		return true, nil
	default:
		return false, errors.New("APP_TIME_FORMAT must be 24h or 12h")
	}
}

func parsePublicActivity(lookup LookupFunc) (bool, error) {
	switch valueOrDefault(lookup, "APP_PUBLIC_ACTIVITY_ENABLED", "false") {
	case "false":
		return false, nil
	case "true":
		return true, nil
	default:
		return false, errors.New("APP_PUBLIC_ACTIVITY_ENABLED must be true or false")
	}
}

func parsePublicURL(lookup LookupFunc, environment Environment, fallback *url.URL) (*url.URL, error) {
	value := required(lookup, "APP_VIKUNJA_PUBLIC_URL")
	if value == "" {
		return fallback, nil
	}
	parsed, err := parseVikunjaURL(value, environment)
	if err != nil {
		return nil, errors.New(strings.ReplaceAll(err.Error(), "APP_VIKUNJA_URL", "APP_VIKUNJA_PUBLIC_URL"))
	}
	return parsed, nil
}

func required(lookup LookupFunc, name string) string {
	value, _ := lookup(name)
	return value
}

func valueOrDefault(lookup LookupFunc, name string, fallback string) string {
	value, ok := lookup(name)
	if !ok || value == "" {
		return fallback
	}
	return value
}

func validateRequired(configuration Config) error {
	requiredValues := []struct {
		name  string
		value string
	}{
		{name: "APP_VIKUNJA_API_TOKEN", value: configuration.VikunjaAPIToken},
		{name: "APP_AUTH_USERNAME", value: configuration.AuthUsername},
		{name: "APP_AUTH_PASSWORD", value: configuration.AuthPassword},
	}

	for _, item := range requiredValues {
		if item.value == "" {
			return fmt.Errorf("%s is required", item.name)
		}
	}

	return nil
}

func parseEnvironment(value string) (Environment, error) {
	environment := Environment(value)
	switch environment {
	case EnvironmentProduction, EnvironmentDevelopment, EnvironmentTest:
		return environment, nil
	default:
		return "", errors.New("APP_ENV must be production, development, or test")
	}
}

func parseLogLevel(value string) (LogLevel, error) {
	level := LogLevel(value)
	switch level {
	case LogLevelDebug, LogLevelInfo, LogLevelWarn, LogLevelError:
		return level, nil
	default:
		return "", errors.New("APP_LOG_LEVEL must be debug, info, warn, or error")
	}
}

func parseVikunjaURL(value string, environment Environment) (*url.URL, error) {
	if value == "" {
		return nil, errors.New("APP_VIKUNJA_URL is required")
	}

	parsed, err := url.Parse(value)
	if err != nil || !parsed.IsAbs() || parsed.Host == "" {
		return nil, errors.New("APP_VIKUNJA_URL must be an absolute HTTP(S) URL")
	}
	if parsed.Scheme != httpScheme && parsed.Scheme != httpsScheme {
		return nil, errors.New("APP_VIKUNJA_URL must use HTTP or HTTPS")
	}
	if environment == EnvironmentProduction && parsed.Scheme != httpsScheme {
		return nil, errors.New("APP_VIKUNJA_URL must use HTTPS in production")
	}
	if parsed.User != nil {
		return nil, errors.New("APP_VIKUNJA_URL must not contain user information")
	}
	if parsed.RawQuery != "" {
		return nil, errors.New("APP_VIKUNJA_URL must not contain a query")
	}
	if parsed.Fragment != "" {
		return nil, errors.New("APP_VIKUNJA_URL must not contain a fragment")
	}

	parsed.Path = strings.TrimRight(parsed.Path, "/")
	return parsed, nil
}

func parseAllowedOrigin(lookup LookupFunc, environment Environment) (*url.URL, error) {
	value, ok := lookup("APP_ALLOWED_ORIGIN")
	if (!ok || value == "") && environment == EnvironmentDevelopment {
		value = "http://localhost:5173"
	}
	if value == "" {
		return nil, errors.New("APP_ALLOWED_ORIGIN is required outside development")
	}

	parsed, err := url.Parse(value)
	if err != nil || !parsed.IsAbs() || parsed.Host == "" {
		return nil, errors.New("APP_ALLOWED_ORIGIN must be an absolute HTTP(S) origin")
	}
	if parsed.Scheme != httpScheme && parsed.Scheme != httpsScheme {
		return nil, errors.New("APP_ALLOWED_ORIGIN must be an HTTP(S) origin")
	}
	if environment == EnvironmentProduction && parsed.Scheme != httpsScheme {
		return nil, errors.New("APP_ALLOWED_ORIGIN must use HTTPS in production")
	}
	if !isOriginOnly(parsed) {
		return nil, errors.New("APP_ALLOWED_ORIGIN must contain only an origin")
	}

	return parsed, nil
}

func isOriginOnly(parsed *url.URL) bool {
	return parsed.User == nil && parsed.Path == "" && parsed.RawPath == "" &&
		parsed.RawQuery == "" && parsed.Fragment == ""
}

func parseSessionSecret(value string) ([]byte, error) {
	if value == "" {
		return nil, errors.New("APP_SESSION_SECRET is required")
	}

	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, errors.New("APP_SESSION_SECRET must be valid base64")
	}
	if len(decoded) < minimumSessionSecretBytes {
		return nil, errors.New("APP_SESSION_SECRET must decode to at least 32 bytes")
	}

	return decoded, nil
}

func validateHTTPAddr(value string) error {
	if _, _, err := net.SplitHostPort(value); err != nil {
		return fmt.Errorf("APP_HTTP_ADDR must be a valid listen address: %w", err)
	}
	return nil
}
