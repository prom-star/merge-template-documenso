# Documenso Migration & Utility Tool

This is a specialized, internal web-based tool built to assist with bulk operations and template migrations for a self-hosted Documenso instance. 

> **Note:** This project is primarily intended as a one-time use or temporary utility script to facilitate a large-scale migration and cleanup effort. It is not intended for public end-users.

## Features

1. **SignNow to Documenso Migration**: Browse SignNow folders, extract documents (along with their recipient roles, text fields, checkboxes, dropdowns, and signatures), and automatically stamp them into standard AcroForm PDFs. These are then instantly uploaded as usable templates into Documenso.
2. **Template Merging**: Select multiple Documenso templates and merge them sequentially into a single, cohesive PDF template, while dynamically mapping and retaining field positions.
3. **Bulk Field Resizing (Squaring)**: Automatically scans Documenso templates to fix field aspect ratios (e.g., forcing checkboxes to be perfectly square) via Documenso's API.

## Tech Stack
- **Backend**: Node.js, Express, `pdf-lib` (for low-level PDF AcroForm manipulation)
- **Frontend**: React, Vite, Tailwind CSS
- **Integrations**: Documenso API, SignNow API, Supabase Storage

---

## Getting Started

### 1. Environment Setup
Copy the example environment file and fill in your credentials:
```bash
cp .env.example .env
```
Ensure you have the following keys filled out in your `.env`:
- `DOCUMENSO_API_TOKEN` & `DOCUMENSO_BASE_URL` (For the production instance)
- `DEV_DOCUMENSO_API_TOKEN` & `DEV_DOCUMENSO_BASE_URL` (For testing in dev)
- `SUPABASE_*` variables (For downloading raw PDFs from your self-hosted Documenso storage)
- `SIGNNOW_ACCESS_TOKEN` & `SIGNNOW_ROOT_FOLDER_ID` (For the SignNow migration tool)

### 2. Installation
Install the root dependencies (which will also install the client dependencies if configured correctly, or install them manually):
```bash
npm install
cd client && npm install && cd ..
```

### 3. Running Locally

**Start the Backend Server (Port 3001)**
```bash
npm start
```

**Start the Frontend Vite Dev Server (Port 3000)**
```bash
npm run dev:client
```
The application will be accessible at `http://localhost:3000`.

---

## Deployment
This tool is configured to be deployed on **Vercel** or **Railway**. 
- The build command should point to `npm run build` inside the `client` directory.
- The output directory should be `client/dist`.
- Ensure all `.env` variables are securely added to your platform's environment settings.
