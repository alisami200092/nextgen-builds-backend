FROM node:20-slim

# Install Python and pip
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python requirements and install
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy Node dependency definitions and install
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files (including fps_predictor_brain.pkl and predict_fps.py)
COPY . .

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]
