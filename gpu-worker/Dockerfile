FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04

WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    git python3 python3-pip blender libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch, DINOv2 (timm/transformers), RunPod SDK, and Boto3 (for Cloudflare R2)
RUN pip3 install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cu121 \
    runpod transformers accelerate safetensors trimesh boto3 rembg

COPY handler.py /workspace/handler.py

CMD ["python3", "-u", "/workspace/handler.py"]
