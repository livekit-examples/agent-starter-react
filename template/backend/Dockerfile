# Use an official Python base image
FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Install system dependencies for Pillow (PIL)
RUN apt-get update && apt-get install -y \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy your agent code and assets
COPY test/ /app/
COPY assets/ /app/assets/
COPY requirements.txt /app/

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Set the entrypoint to your agent worker
CMD ["python", "agent_worker.py", "start"] 