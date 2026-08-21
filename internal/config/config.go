package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
)

type Environment string

const (
	EnvironmentProduction  Environment = "production"
	EnvironmentDevelopment Environment = "development"
	EnvironmentTest        Environment = "test"
)

type LogLevel string

const (
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

type Config struct {
	VikunjaURL      *url.URL
	VikunjaAPIToken string
	AuthUsername    string
	AuthPassword    string
	SessionSecret   []byte
	HTTPAddr        string
	LogLevel        LogLevel
	Environment     Environment
	AllowedOrigin   *url.URL
}

type LookupFunc func(string) (string, bool)

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

	return configuration, nil
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
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("APP_VIKUNJA_URL must use HTTP or HTTPS")
	}
	if environment == EnvironmentProduction && parsed.Scheme != "https" {
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
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("APP_ALLOWED_ORIGIN must be an HTTP(S) origin")
	}
	if environment == EnvironmentProduction && parsed.Scheme != "https" {
		return nil, errors.New("APP_ALLOWED_ORIGIN must use HTTPS in production")
	}
	if parsed.User != nil || parsed.Path != "" || parsed.RawPath != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, errors.New("APP_ALLOWED_ORIGIN must contain only an origin")
	}

	return parsed, nil
}

func parseSessionSecret(value string) ([]byte, error) {
	if value == "" {
		return nil, errors.New("APP_SESSION_SECRET is required")
	}

	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return nil, errors.New("APP_SESSION_SECRET must be valid base64")
	}
	if len(decoded) < 32 {
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
