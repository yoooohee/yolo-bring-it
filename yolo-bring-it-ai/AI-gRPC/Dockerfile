# Use official Python slim image for a smaller footprint
FROM python:3.11

# Install system dependencies for OpenCV and related libraries
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy requirements files from the root directory
COPY requirements_ai.txt requirements_grpc.txt ./

# Install dependencies with increased timeout
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements_ai.txt -r requirements_grpc.txt

# Copy the ai_services directory to the working directory
COPY ai_services /app/ai_services

# Compile .proto files to generate Python files
RUN python -m grpc_tools.protoc -I./ai_services/protos --python_out=./ai_services/protos/generated --grpc_python_out=./ai_services/protos/generated ./ai_services/protos/*.proto

# Set working directory to ai_services
WORKDIR /app/ai_services

# Expose the default gRPC port
EXPOSE 50051

# Command to run the gRPC server
CMD ["python", "service.py"]