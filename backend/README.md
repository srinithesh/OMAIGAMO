# Veridian Fleet - Backend Server

This directory contains the Python backend for the Veridian Fleet application, built with FastAPI.

## Prerequisites

- Python 3.8+ installed on your system.
- `pip` (Python package installer).

## 1. Setup

It is highly recommended to use a virtual environment to manage dependencies.

### Create a Virtual Environment

Open your terminal in this `backend` directory and run:

```bash
# For macOS/Linux
python3 -m venv venv

# For Windows
python -m venv venv
```

### Activate the Virtual Environment

```bash
# For macOS/Linux
source venv/bin/activate

# For Windows
.\venv\Scripts\activate
```

### Install Dependencies

With the virtual environment active, install the required packages from `requirements.txt`:

```bash
pip install -r requirements.txt
```

## 2. Running the Server

Once the setup is complete, you can start the development server:

```bash
uvicorn main:app --reload
```

- `uvicorn`: The ASGI server that will run our application.
- `main`: The Python file (`main.py`).
- `app`: The FastAPI application object created inside `main.py`.
- `--reload`: This flag enables auto-reloading, so the server will restart automatically whenever you make changes to the code.

The server will start and be accessible at **http://127.0.0.1:8000**. The frontend application is configured to send requests to this address.

## API Endpoint

### `POST /api/analyze`

- **Description:** Receives the YOLO model, video feed, and transaction log for analysis.
- **Request Body:** `multipart/form-data`
  - `yolo_model_file`: The `.pt` or `.weights` model file.
  - `video_file`: The `.mp4` video file.
  - `transaction_log_file`: The `.csv` log file.
- **Response:** A JSON object containing the processed analysis data (`transactions`, `aiDetections`, `rtoData`).

**Note:** In this initial version, the AI analysis is still mocked, but the file parsing and API communication are fully functional.
