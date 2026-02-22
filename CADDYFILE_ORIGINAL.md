# Caddyfile Original (Limpo)

Copie todo o cÃ³digo abaixo e cole no arquivo `/etc/caddy/Caddyfile` no Termius.
Este arquivo remove a configuraÃ§Ã£o de IP e mantÃ©m apenas o DuckDNS com HTTPS.

```caddy
{
    servers {
        protocols h1 h2
    }
}

centraldedados.dev.br {
    encode gzip zstd
    
    # O bloco header abaixo foi removido para evitar conflito de CORS com o PocketBase
    # O PocketBase jÃ¡ envia esses headers nativamente.

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

## InstruÃ§Ãµes para aplicar no Termius:

1.  Abra o arquivo: `sudo nano /etc/caddy/Caddyfile`
2.  Apague **TUDO** o que estÃ¡ lÃ¡ (Dica: segure `Ctrl+K` para cortar linhas rapidamente).
3.  Cole o conteÃºdo acima.
4.  Salve: `Ctrl+O` -> `Enter`.
5.  Saia: `Ctrl+X`.
6.  Recarregue: `sudo systemctl reload caddy`.

