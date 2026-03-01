#!/usr/bin/env bash

# Create bin directory
mkdir -p yt-dlp-bin

# Download yt-dlp Linux binary
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp-bin/yt-dlp
chmod a+rx yt-dlp-bin/yt-dlp

# Install app dependencies
npm install
