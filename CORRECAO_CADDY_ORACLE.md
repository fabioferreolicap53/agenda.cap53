O problema de acesso via rede mÃ³vel com o Caddy na Oracle Cloud geralmente ocorre por duas razÃµes principais: **configuraÃ§Ã£o de HTTPS/TLS** ou **bloqueio de Firewall (Ingress Rules)**.

### SoluÃ§Ã£o Passo a Passo

Para corrigir o erro de acesso via rede mÃ³vel, vocÃª precisa ajustar a configuraÃ§Ã£o do Caddy na sua VM e verificar as regras de firewall da Oracle Cloud.

#### 1. Atualizar o Caddyfile na VM

Conecte-se via SSH Ã  sua VM na Oracle Cloud e edite o arquivo `Caddyfile` (geralmente em `/etc/caddy/Caddyfile`). Substitua o conteÃºdo pela configuraÃ§Ã£o abaixo, que Ã© otimizada para PocketBase e resolve problemas de acesso mÃ³vel:

```caddy
centraldedados.dev.br {
    # Habilita compressÃ£o para melhor performance em redes mÃ³veis
    encode gzip zstd

    # Proxy reverso para o PocketBase (assumindo porta 8090)
    reverse_proxy 127.0.0.1:8090 {
        # ConfiguraÃ§Ãµes essenciais para estabilidade
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Headers de seguranÃ§a recomendados (ajuda em alguns navegadores mÃ³veis)
    header {
        # Habilita HSTS (apenas se tiver certeza que sempre usarÃ¡ HTTPS)
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }

    # ConfiguraÃ§Ã£o TLS explÃ­cita (opcional, mas ajuda se houver problemas de negociaÃ§Ã£o)
    tls {
        # ForÃ§a protocolos modernos
        protocols tls1.2 tls1.3
    }
}
```

ApÃ³s editar, recarregue o Caddy:
```bash
sudo systemctl reload caddy
```

#### 2. Verificar Firewall da Oracle Cloud (Security Lists)

Redes mÃ³veis muitas vezes usam IPs dinÃ¢micos e protocolos que podem ser bloqueados se as regras nÃ£o forem permissivas.

1.  Acesse o painel da **Oracle Cloud**.
2.  VÃ¡ em **Networking** > **Virtual Cloud Networks**.
3.  Clique na sua VCN e depois em **Security Lists** (geralmente a "Default Security List").
4.  Verifique as **Ingress Rules** (Regras de Entrada). VocÃª deve ter:
    *   **Porta 80 (TCP):** Source `0.0.0.0/0`
    *   **Porta 443 (TCP):** Source `0.0.0.0/0`
    *   **Porta 443 (UDP):** Source `0.0.0.0/0` (Importante! O Caddy tenta usar HTTP/3 via UDP, e redes mÃ³veis preferem isso. Se estiver bloqueado, pode causar falha ou lentidÃ£o).

**Dica:** Adicione a regra para **UDP na porta 443** se ela nÃ£o existir.

#### 3. Verificar Firewall Interno da VM (iptables/netfilter)

Na Oracle Cloud, alÃ©m do painel web, a prÃ³pria VM tem um firewall (iptables). Execute estes comandos na VM para garantir que as portas estÃ£o abertas:

```bash
# Abrir portas HTTP/HTTPS (se usar ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp

# Se usar iptables direto (Oracle Linux/Ubuntu padrÃ£o)
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### Resumo TÃ©cnico do Problema
O Caddy, por padrÃ£o, tenta negociar conexÃµes modernas usando **HTTP/3 (QUIC)** sobre **UDP**. Redes mÃ³veis modernas priorizam esse protocolo. Se o Firewall da Oracle (Security List) bloquear UDP na porta 443, a conexÃ£o pode falhar ou ficar "pendurada" atÃ© dar timeout, resultando no erro de conexÃ£o no celular, enquanto no Wi-Fi (que pode forÃ§ar TCP/HTTP2) funciona.

