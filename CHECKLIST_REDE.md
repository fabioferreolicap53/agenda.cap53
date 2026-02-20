# Lista de Verificação (Checklist) para Correção de Rede

Execute estes passos no Termius um por um para garantir que a correção foi aplicada.

## 1. Verificar se o comando MTU foi aplicado (MUITO IMPORTANTE)
Este comando é o que resolve a maioria dos problemas em VPNs e Redes Corporativas.

Copie e cole no terminal:
```bash
sudo iptables -t mangle -L OUTPUT -n | grep TCPMSS
```
**Se não aparecer nada**, significa que o comando **não foi executado ou não funcionou**.
Execute novamente:
```bash
sudo iptables -t mangle -A OUTPUT -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
```

## 2. Recarregar o Caddy
Você editou o arquivo, mas o Caddy precisa carregar a nova configuração.

Copie e cole:
```bash
caddy fmt /etc/caddy/Caddyfile --overwrite
sudo systemctl reload caddy
```
Se der erro no reload, verifique o status:
```bash
sudo systemctl status caddy
```

## 3. Verificar Logs de Erro
Se ainda não funcionar, veja o que o Caddy está dizendo:
```bash
sudo journalctl -u caddy --no-pager | tail -n 20
```

## 4. Teste Final (A partir do seu computador com problema)
Abra o navegador e tente acessar:
`https://centraldedados.duckdns.org/api/health`

- Se abrir um JSON `{"code": 200, "message": "API is healthy."}`: A conexão está funcionando! O problema pode ser cache do navegador (limpe o cache).
- Se der "Erro de Certificado": A rede da empresa está interceptando a conexão.
- Se der "Timeout" ou "Não foi possível conectar": O firewall da empresa está bloqueando o IP/Porta completamente.
