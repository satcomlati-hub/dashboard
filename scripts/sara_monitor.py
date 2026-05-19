import time
import json
import socket
import os
import subprocess
import psutil
import redis

# Configuración de Redis
REDIS_HOST = "redis-17553.c16.us-east-1-3.ec2.cloud.redislabs.com"
REDIS_PORT = 17553
REDIS_PASSWORD = "LHV5rHVsQvzKRLYwVBzVPjwVsTe9dyVW"
REDIS_DB = 0

# Conexión a Redis
r = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    db=REDIS_DB,
    decode_responses=True
)

def get_service_status(service_name):
    try:
        # Verifica usando systemctl
        res = subprocess.run(["systemctl", "is-active", service_name], capture_output=True, text=True)
        return res.stdout.strip() == "active"
    except Exception:
        return False

def get_n8n_status():
    # Comprobar si el puerto 5678 (puerto n8n por defecto) responde
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex(('127.0.0.1', 5678))
            if result == 0:
                return True
    except Exception:
        pass
    
    # También podemos buscar el proceso
    for proc in psutil.process_iter(['name', 'cmdline']):
        try:
            cmd = proc.info['cmdline']
            if cmd and any('n8n' in arg for arg in cmd):
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return False

def get_metrics():
    # CPU (medido en un intervalo corto)
    cpu_percent = psutil.cpu_percent(interval=1)
    
    # RAM
    ram = psutil.virtual_memory()
    ram_total = ram.total / (1024 * 1024) # MB
    ram_used = ram.used / (1024 * 1024) # MB
    ram_percent = ram.percent
    
    # Disk
    disk = psutil.disk_usage('/')
    disk_total = disk.total / (1024 * 1024 * 1024) # GB
    disk_used = disk.used / (1024 * 1024 * 1024) # GB
    disk_percent = disk.percent
    
    # Load Average
    try:
        load1, load5, load15 = os.getloadavg()
    except Exception:
        load1, load5, load15 = 0.0, 0.0, 0.0
    
    # Network
    net1 = psutil.net_io_counters()
    time.sleep(0.5)
    net2 = psutil.net_io_counters()
    
    # Bytes/sec * 2 para obtener velocidad por segundo (ya que dormimos 0.5s)
    bytes_sent_per_sec = (net2.bytes_sent - net1.bytes_sent) * 2
    bytes_recv_per_sec = (net2.bytes_recv - net1.bytes_recv) * 2
    
    # Servicios
    docker_active = get_service_status("docker")
    n8n_active = get_n8n_status()
    
    return {
        "timestamp": int(time.time()),
        "cpu_percent": cpu_percent,
        "ram": {
            "total_mb": round(ram_total, 2),
            "used_mb": round(ram_used, 2),
            "percent": ram_percent
        },
        "disk": {
            "total_gb": round(disk_total, 2),
            "used_gb": round(disk_used, 2),
            "percent": disk_percent
        },
        "load_average": {
            "1m": round(load1, 2),
            "5m": round(load5, 2),
            "15m": round(load15, 2)
        },
        "network": {
            "bytes_sent_sec": bytes_sent_per_sec,
            "bytes_recv_sec": bytes_recv_per_sec
        },
        "services": {
            "docker": docker_active,
            "n8n": n8n_active
        }
    }

def main():
    print("Iniciando Satcom SARA Performance Monitor...")
    while True:
        try:
            metrics = get_metrics()
            metrics_json = json.dumps(metrics)
            
            # 1. Guardar estado live (TTL 15s)
            r.set("sara:metrics:live", metrics_json, ex=15)
            
            # 2. Guardar en el histórico (LPUSH y limitar a 120 entradas para ~6 minutos)
            r.lpush("sara:metrics:history", metrics_json)
            r.ltrim("sara:metrics:history", 0, 119)
            
            print(f"Metricas enviadas: CPU {metrics['cpu_percent']}%, RAM {metrics['ram']['percent']}%")
        except Exception as e:
            print(f"Error en el ciclo de monitoreo: {e}")
        
        # Dormimos 2.5s antes del siguiente ciclo (el get_metrics duerme 0.5s para la red, dando un ciclo de 3s en total)
        time.sleep(2.5)

if __name__ == "__main__":
    main()
