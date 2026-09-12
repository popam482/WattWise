#python image
FROM python:3.12-slim

WORKDIR /app

# create and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# cpoy code
COPY . .

#port 8000
EXPOSE 8000

# run Uvicorn server
CMD ["uvicorn", "microservices.app:app", "--host", "0.0.0.0", "--port", "8000"]