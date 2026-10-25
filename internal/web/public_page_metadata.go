package web

import (
	"fmt"
	"time"
)

const (
	schemaContext     = "@context"
	schemaType        = "@type"
	schemaID          = "@id"
	schemaURL         = "url"
	schemaOrg         = "https://schema.org"
	schemaDescription = "description"
	schemaName        = "name"
)

func rootPageMetadata(options PublicPageOptions) publicPageMetadata {
	metadata := basePageMetadata(options, "/", defaultPageTitle, pageDescription)
	websiteID := metadata.Canonical + "#website"
	applicationID := metadata.Canonical + "#application"
	productID := repositoryURL + "#software"
	softwareID := repositoryURL + "#source"
	metadata.JSONLD = map[string]any{
		schemaContext: schemaOrg,
		"@graph": []any{
			map[string]any{
				schemaID: websiteID, schemaType: "WebSite", schemaName: "Better Vikunja instance",
				schemaDescription: pageDescription, schemaURL: metadata.Canonical,
				"mainEntity": map[string]string{schemaID: applicationID},
			},
			map[string]any{
				schemaID: applicationID, schemaType: "WebApplication", schemaName: "Better Vikunja instance",
				"applicationCategory": "ProductivityApplication", "isAccessibleForFree": true,
				schemaDescription: pageDescription, schemaURL: metadata.Canonical,
				"isBasedOn": map[string]string{schemaID: productID},
			},
			map[string]any{
				schemaID: productID, schemaType: "SoftwareApplication", schemaName: "Better Vikunja",
				"applicationCategory": "ProductivityApplication", "isAccessibleForFree": true,
				schemaDescription: productDescription, schemaURL: repositoryURL,
			},
			map[string]any{
				schemaID: softwareID, schemaType: "SoftwareSourceCode", schemaName: "Better Vikunja source code",
				"codeRepository": repositoryURL, "license": licenseURL,
				"targetProduct": map[string]string{schemaID: productID},
			},
		},
	}
	return metadata
}

func activityPageMetadata(options PublicPageOptions, activity publicActivityResponse) publicPageMetadata {
	metadata := basePageMetadata(
		options, "/activity", "14-day activity — Better Vikunja instance",
		"Anonymous aggregate task activity from this Better Vikunja instance for the last 14 days.",
	)
	metadata.BootstrapID = "public-activity-bootstrap"
	start, end := "", ""
	if len(activity.Days) > 0 {
		start, end = activity.Days[0].Date, activity.Days[len(activity.Days)-1].Date
	}
	metadata.JSONLD = activityDataset(
		"Better Vikunja 14-day activity", metadata.Description, metadata.Canonical,
		publicDataURL(options, "/public/v1/activity"), fmt.Sprintf("%s/%s", start, end),
		activityTimestamp(activity.GeneratedAt),
	)
	return metadata
}

func allTimePageMetadata(options PublicPageOptions, activity publicAllTimeActivityResponse) publicPageMetadata {
	metadata := basePageMetadata(
		options, "/all-time-activity", "All-time activity — Better Vikunja instance",
		"Anonymous aggregate task history from this Better Vikunja instance, with the latest 13 weekly buckets.",
	)
	metadata.BootstrapID = "public-all-time-activity-bootstrap"
	start, end := "", ""
	if len(activity.Weeks) > 0 {
		start, end = activity.Weeks[0].Date, activity.Weeks[len(activity.Weeks)-1].Date
	}
	metadata.JSONLD = activityDataset(
		"Better Vikunja all-time activity", metadata.Description, metadata.Canonical,
		publicDataURL(options, "/public/v1/all-time-activity"), fmt.Sprintf("%s/%s", start, end),
		activityTimestamp(activity.GeneratedAt),
	)
	return metadata
}

func activityTimestamp(value time.Time) string {
	return value.UTC().Format(time.RFC3339)
}

func basePageMetadata(options PublicPageOptions, path, title, description string) publicPageMetadata {
	metadata := publicPageMetadata{
		Title: title, Description: description, Robots: "noindex, nofollow",
		ActivityEnabled: options.ActivityEnabled, AllTimeEnabled: options.AllTimeEnabled,
		JSONLD: map[string]string{schemaContext: schemaOrg, schemaType: "WebPage", schemaName: title},
	}
	if options.PublicURL == nil {
		return metadata
	}
	metadata.Robots = "index, follow"
	metadata.Canonical = options.PublicURL.String() + path
	metadata.Image = options.PublicURL.String() + "/social-preview.png"
	return metadata
}

func publicDataURL(options PublicPageOptions, path string) string {
	if options.PublicURL == nil {
		return ""
	}
	return options.PublicURL.String() + path
}

func activityDataset(name, description, pageURL, dataURL, temporalCoverage, generatedAt string) map[string]any {
	dataset := map[string]any{
		schemaContext: schemaOrg, schemaType: "Dataset", schemaName: name,
		schemaDescription: description, schemaURL: pageURL, "temporalCoverage": temporalCoverage,
		"dateModified": generatedAt,
	}
	if dataURL != "" {
		dataset["distribution"] = map[string]any{
			schemaType: "DataDownload", "encodingFormat": "application/json", "contentUrl": dataURL,
		}
	}
	return dataset
}
