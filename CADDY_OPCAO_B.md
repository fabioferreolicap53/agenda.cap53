# Como Habilitar Acesso via IP (Opção B)

Essa configuração permite acessar o PocketBase diretamente pelo IP da Oracle Cloud (`http://137.131.183.95`), contornando o bloqueio de DNS Dinâmico da empresa.

## 1. Atualize o Caddyfile (no Servidor)

Edite o arquivo:
```bash
sudo nano /etc/caddy/Caddyfile
```

Adicione o bloco do IP (`137.131.183.95`) logo após o bloco do domínio. O arquivo deve ficar assim:

```caddy
{
    servers {
        protocols h1 h2
    }
}

centraldedados.duckdns.org {
    encode gzip zstd
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Origin, Content-Type, Authorization, X-Requested-With"
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
    }
    reverse_proxy 127.0.0.1:8090 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    tls {
        protocols tls1.2 tls1.3
    }
}

# --- NOVO BLOCO PARA ACESSO VIA IP (SEM HTTPS) ---
http://137.131.183.95 {
    reverse_proxy 127.0.0.1:8090
    
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Origin, Content-Type, Authorization, X-Requested-With"
    }
}
```

Salve (`Ctrl+O`, `Enter`) e saia (`Ctrl+X`).
Recarregue o Caddy:
```bash
sudo systemctl reload caddy
```

## 2. Atualize o Frontend (No seu computador de desenvolvimento)

Para que o aplicativo funcione na rede bloqueada, você precisa apontar ele para o IP em vez do domínio.

1. Abra o arquivo `.env` no seu projeto local.
2. Altere a linha `VITE_POCKETBASE_URL`:

```env
# VITE_POCKETBASE_URL=https://centraldedados.duckdns.org
VITE_POCKETBASE_URL=http://137.131.183.95
```

3. Reinicie seu servidor de desenvolvimento (`npm run dev`) ou gere uma nova build.

---
**Observação:** Ao usar o IP, o navegador mostrará "Não seguro" na barra de endereços. Isso é esperado e necessário para contornar o bloqueio do FortiGuard sem comprar um domínio.
