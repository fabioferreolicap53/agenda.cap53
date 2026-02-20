# Correção de Acesso em Redes Corporativas/VPN (IPs 10.x.x.x)

Se você está enfrentando problemas de acesso ao PocketBase especificamente em redes que iniciam com IP `10.9.x.x` (comum em redes corporativas, VPNs ou provedores via rádio/fibra com CGNAT), o problema geralmente é causado por **MTU (Tamanho do Pacote)** ou **Bloqueio de CORS**.

Siga estes passos no seu servidor (via Termius) para corrigir.

## 1. Ajustar o MTU (MSS Clamping) no Servidor
Redes do tipo VPN ou corporativas frequentemente têm um tamanho máximo de pacote (MTU) menor que o padrão da internet (1500 bytes). Se o seu servidor tentar enviar pacotes grandes, eles serão descartados silenciosamente, fazendo a conexão "travar" ou dar timeout, mesmo que o ping funcione.

Execute este comando no terminal do servidor para ajustar automaticamente o tamanho dos pacotes TCP:

```bash
sudo iptables -t mangle -A OUTPUT -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
```

Para garantir que essa regra persista após reiniciar o servidor:
```bash
sudo netfilter-persistent save
```

## 2. Adicionar Headers CORS no Caddy
Se você estiver desenvolvendo ou acessando via aplicações web locais nessa rede, o navegador pode bloquear a conexão por segurança (CORS). Vamos configurar o Caddy para permitir acesso de qualquer origem.

Edite seu arquivo Caddyfile:
```bash
sudo nano /etc/caddy/Caddyfile
```

Substitua o conteúdo pelo abaixo (adicionamos a seção `header` com permissões CORS):

```caddy
centraldedados.duckdns.org {
    encode gzip zstd

    # Headers de Segurança e CORS (Permite acesso de qualquer origem)
    header {
        # Permite acesso de qualquer origem (útil para redes locais/desenvolvimento)
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Access-Control-Allow-Headers "Origin, Content-Type, Authorization, X-Requested-With"
        
        # Segurança HTTPS
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
```

Salve o arquivo (`Ctrl+O`, `Enter`) e saia (`Ctrl+X`).
Em seguida, recarregue o Caddy:

```bash
sudo systemctl reload caddy
```

## 3. Liberar Tráfego de IPs Privados (Opcional)
Se o firewall do servidor (iptables) estiver bloqueando faixas de IP privadas por segurança, você pode liberar explicitamente a faixa `10.0.0.0/8`.

Execute:
```bash
sudo iptables -I INPUT -s 10.0.0.0/8 -j ACCEPT
sudo netfilter-persistent save
```

---
**Resumo:** O comando de MSS Clamping (passo 1) é o mais importante para corrigir falhas de conexão em redes específicas (VPNs/Corporativas). O passo 2 resolve problemas de aplicações web/mobile rodando localmente.
