import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PrintEventData {
    responsavel: string;
    nomeEvento: string;
    localEvento: string;
    dataInicio: string;
    dataFim: string;
    observacoes: string;
    participantes: number | string;
    insumos: {
        quantidade: number | string;
        nome: string;
        status?: string;
    }[];
    departamento: string; // 'Almoxarifado e Copa', 'Informática' ou 'Transporte'
}

export const printEventDoc = (data: PrintEventData) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Impressão - ${data.nomeEvento}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
                
                :root {
                    --print-scale: 1;
                }

                @media print {
                    @page { margin: 1cm; size: A4 portrait; }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
                
                body {
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    color: #0f172a;
                    line-height: 1.4;
                    margin: 0;
                    padding: 0;
                    transform-origin: top center;
                    zoom: var(--print-scale);
                }
                
                .container {
                    width: 760px;
                    margin: 0 auto;
                    padding: 10px;
                }
                
                .header {
                    text-align: center;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 20px;
                    margin-bottom: 24px;
                }
                
                .header-department {
                    font-size: 14px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.25em;
                    color: #64748b;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }
                
                .header-title {
                    font-size: 38px;
                    font-weight: 900;
                    color: #0f172a;
                    margin: 0;
                    letter-spacing: -0.04em;
                    line-height: 1.1;
                }
                
                .section {
                    margin-bottom: 24px;
                    page-break-inside: avoid;
                }
                
                .section-title {
                    font-size: 14px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    color: #94a3b8;
                    border-bottom: 2px solid #f1f5f9;
                    padding-bottom: 10px;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                }
                
                .info-block {
                    margin-bottom: 10px;
                }
                
                .label {
                    font-size: 11px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #94a3b8;
                    display: block;
                    margin-bottom: 4px;
                }
                
                .value {
                    font-size: 16px;
                    font-weight: 700;
                    color: #334155;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .highlight-box {
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 32px;
                    margin-top: 32px;
                    page-break-inside: avoid;
                }
                
                .highlight-box .section-title {
                    color: #0f172a;
                    border-bottom-color: #e2e8f0;
                    justify-content: center;
                    margin-bottom: 24px;
                    font-size: 16px;
                }
                
                table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                }
                
                th {
                    text-align: left;
                    font-size: 12px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #64748b;
                    padding: 12px 16px;
                    border-bottom: 2px solid #e2e8f0;
                }
                
                td {
                    padding: 16px;
                    font-size: 15px;
                    font-weight: 700;
                    color: #1e293b;
                    border-bottom: 1px solid #f1f5f9;
                }
                
                tr:last-child td {
                    border-bottom: none;
                }
                
                .qty-badge {
                    background-color: #0f172a;
                    color: #ffffff;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 900;
                    display: inline-block;
                    text-align: center;
                    min-width: 20px;
                }
                
                .status-badge {
                    font-size: 11px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    padding: 6px 12px;
                    border-radius: 8px;
                    background-color: #f1f5f9;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                    white-space: nowrap;
                }
                
                .signature-section {
                    margin-top: 60px;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 60px;
                    page-break-inside: avoid;
                }
                
                .signature-box {
                    text-align: center;
                }
                
                .signature-line {
                    border-top: 2px solid #94a3b8;
                    margin-bottom: 10px;
                }
                
                .signature-label {
                    font-size: 11px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #64748b;
                }

                .icon {
                    width: 18px;
                    height: 18px;
                    color: #94a3b8;
                    flex-shrink: 0;
                }
                
                .footer {
                    margin-top: 40px;
                    padding-top: 24px;
                    border-top: 1px solid #f1f5f9;
                    text-align: center;
                    font-size: 11px;
                    font-weight: 700;
                    color: #cbd5e1;
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                }
            </style>
        </head>
        <body>
            <div id="print-container" class="container">
                <div class="header">
                    <div class="header-department">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Ficha de Liberação / Setor: ${data.departamento}
                    </div>
                    <h1 class="header-title">${data.nomeEvento}</h1>
                </div>
                
                <div class="section">
                    <div class="section-title">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        Informações do Evento
                    </div>
                    <div class="grid">
                        <div class="info-block">
                            <span class="label">Responsável</span>
                            <span class="value">
                                <svg class="icon" style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                ${data.responsavel}
                            </span>
                        </div>
                        <div class="info-block">
                            <span class="label">Local</span>
                            <span class="value">
                                <svg class="icon" style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                ${data.localEvento}
                            </span>
                        </div>
                        <div class="info-block">
                            <span class="label">Início</span>
                            <span class="value">
                                <svg class="icon" style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                ${data.dataInicio}
                            </span>
                        </div>
                        <div class="info-block">
                            <span class="label">Término</span>
                            <span class="value">
                                <svg class="icon" style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                ${data.dataFim}
                            </span>
                        </div>
                        <div class="info-block">
                            <span class="label">Participantes</span>
                            <span class="value">
                                <svg class="icon" style="width:12px; height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                ${data.participantes} pessoas
                            </span>
                        </div>
                    </div>
                </div>
 
                ${data.observacoes ? `
                <div class="section">
                    <div class="section-title">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Observações Adicionais
                    </div>
                    <div class="info-block">
                        <div class="value" style="font-style: italic; font-weight: 500; color: #475569; background: #fdfdfd; padding: 16px; border-radius: 12px; border: 1px solid #f1f5f9;">
                            "${data.observacoes.replace(/\n/g, '<br>')}"
                        </div>
                    </div>
                </div>
                ` : ''}
 
                <div class="highlight-box">
                    <div class="section-title">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        Recursos e Insumos Solicitados
                    </div>
                    ${data.insumos.length > 0 ? `
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 70px; text-align: center;">Qtd</th>
                                <th>Especificação do Item / Serviço</th>
                                ${data.insumos.some(i => i.status) ? '<th style="text-align: right;">Status</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.insumos.map(item => `
                            <tr>
                                <td style="text-align: center;"><span class="qty-badge">${item.quantidade}</span></td>
                                <td>${item.nome}</td>
                                ${item.status ? `<td style="text-align: right;"><span class="status-badge">${item.status}</span></td>` : ''}
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ` : `
                    <div style="text-align: center; color: #94a3b8; font-weight: 700; font-size: 13px; padding: 10px;">
                        Nenhum recurso extra solicitado.
                    </div>
                    `}
                </div>

                <div class="signature-section">
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Responsável pela Liberação (${data.departamento})</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Recebido por / Solicitante</div>
                    </div>
                </div>
 
                <div class="footer">
                    Documento Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • Agenda Cap 5.3
                </div>
            </div>

            <script>
                window.onload = function() {
                    const container = document.getElementById('print-container');
                    const targetHeight = 1000; // Altura aproximada de uma página A4 em pixels
                    const currentHeight = container.offsetHeight;
                    
                    if (currentHeight > targetHeight) {
                        const scale = Math.max(0.5, targetHeight / currentHeight);
                        document.documentElement.style.setProperty('--print-scale', scale);
                    }
                    
                    // Pequeno delay para garantir que o zoom seja aplicado antes do print
                    setTimeout(() => {
                        window.print();
                    }, 300);
                };
            </script>
        </body>
        </html>
    `);
    doc.close();

    // Remove o iframe após a impressão ser acionada
    setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    }, 5000);
};
