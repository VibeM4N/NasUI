# Personal NAS Web Interface

A lightweight, browser-based file explorer built with Node.js to access
and manage files on my **personal Windows NAS environment**.

This project provides a web interface for browsing the network shares
and drives configured on my own setup. It is intentionally tailored to
that environment; it is not currently a universal NAS solution or a
plug-and-play application for arbitrary storage devices.

> **Project status: Work in Progress**
>
> The application is under active development. Some configuration is
> specific to my personal NAS, and setup may require changes for use on
> another machine.

## Overview

The goal of this project is to make files on my personal network storage
easier to access through a browser.

A Node.js backend exposes file and share operations through HTTP API
endpoints, while the frontend provides a dashboard and file-explorer
interface. The backend works with the storage locations available in my
configured Windows environment.

The current implementation is designed around my own NAS and Windows
file-sharing setup. Storage paths and environment assumptions may need
to be adapted before running it elsewhere.

## Current Features

### Browse storage

-   Retrieve the available shares and drives exposed by the configured
    environment.
-   Open a share and browse its directories.
-   Navigate nested folders.
-   Use breadcrumb navigation to move between directory levels.
-   View file and folder entries, including available metadata such as
    file size and modification date.
-   Filter entries in the currently open directory.

### Search

-   Search across the configured shares.
-   View matching files and folders with their share and path.
-   Navigate to a search result from the results list.

### Upload and access files

-   Select multiple files for upload.
-   Drag and drop files into the upload area.
-   View upload progress while files are being transferred.
-   Download files through the browser.
-   Preview supported file types in the interface.

### Interface

-   Dashboard showing the available shares and drives.
-   Separate dashboard, explorer and preview views.
-   File-type icons for common formats.
-   Loading, empty-state and error feedback in the interface.

> Feature availability depends on the current implementation and the
> permissions of the Windows account running the backend.

## How It Works

The application uses a simple client-server structure:

``` text
                 Web Browser
                      |
                      |
               Frontend Interface
                      |
                 HTTP Requests
                      |
                Node.js Backend
                      |
                  API Routes
                      |
             Windows File System
                      |
          Configured NAS / SMB Shares
```

1.  The frontend requests the available shares from the backend.
2.  The backend reads information from the storage locations configured
    for the personal NAS environment.
3.  The frontend displays the shares and lets the user navigate
    directories.
4.  File operations such as searching, uploading, downloading and
    previewing are handled through backend endpoints.

## Tech Stack

  Technology                    Role
  ----------------------------- ----------------------------------------
  JavaScript                    Application logic
  Node.js                       Backend runtime
  HTML                          Frontend structure
  CSS                           Frontend styling
  Browser Fetch API             Frontend-to-backend requests
  XMLHttpRequest                Upload progress tracking
  Windows file system and SMB   Access to configured storage locations

The frontend uses browser-native JavaScript APIs to communicate with the
backend. The backend is responsible for interacting with the local
Windows environment and configured shares.

## Project Structure

The exact structure may evolve as development continues. At a high
level, the project contains:

``` text
project/
├── public/          # Frontend assets (if served from this directory)
├── src/             # Backend/application code (if used)
├── package.json     # Project metadata and dependencies
└── README.md
```

Refer to the repository itself for the current file and folder layout.

## Running Locally

### Requirements

-   A Windows machine with access to the NAS.
-   Node.js and npm installed.
-   The NAS and required network shares available to the host machine.
-   A Windows user account with the necessary permissions to access
    those locations.

### Setup

Clone the repository:

``` bash
git clone <YOUR_REPOSITORY_URL>
```

Move into the project directory:

``` bash
cd <YOUR_PROJECT_DIRECTORY>
```

Install dependencies:

``` bash
npm install
```

Start the application using the command configured in the project's
`package.json` scripts.

For example, if a `start` script is defined:

``` bash
npm start
```

Open the local address and port configured by the backend in your
browser.

> **Note:** This project is currently configured for my personal NAS
> environment. Cloning the repository alone may not be enough to run it
> on another machine. The storage paths, share configuration,
> permissions and other environment-specific settings may need to be
> updated first.

## Environment and Compatibility

This is currently a personal-use implementation, not a general-purpose
NAS platform.

-   The application is tailored to my Windows-based NAS setup.
-   It expects the storage shares and paths configured for that
    environment.
-   Access depends on the permissions of the account running the
    backend.
-   Compatibility with other NAS devices, operating systems and network
    configurations has not been established.

## Security Notes

The backend can access files that are available to the Windows account
running it. Treat the application as a trusted, local-network tool.

-   Do not expose the server directly to the public internet.
-   Run it with only the file-system permissions it needs.
-   Do not commit passwords, credentials, API keys or other secrets.
-   Review and validate file paths and incoming requests before using
    the application with important data.
-   Use appropriate network and host-level access controls.

This README does not claim that the application currently provides
authentication, multi-user access control or production-grade security.

## Roadmap

Possible areas for future development:

-   Move NAS-specific paths and settings into a configurable file or
    environment variables.
-   Make setup easier on a different Windows machine.
-   Improve file-operation validation and error handling.
-   Add clearer storage and disk-usage information.
-   Expand file preview support.
-   Improve the interface and large-file upload experience.
-   Review and strengthen access control before considering broader
    network deployment.

## Author

**Vaibhav N**

-   GitHub: [@VibeM4N](https://github.com/VibeM4N)

------------------------------------------------------------------------

A personal project exploring Node.js, Windows file-system access,
network shares and browser-based file management.
