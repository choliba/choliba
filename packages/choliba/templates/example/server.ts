import { join } from 'node:path';

const page = Bun.file(join(import.meta.dir, 'index.html'));

export function handleExemploRequest(req: Request): Response | null {
  const url = new URL(req.url);

  if (url.pathname === '/') {
    return new Response(page);
  }

  return null;
}

// Inicia o servidor APENAS se este arquivo for executado diretamente
if (import.meta.main) {
  const server = Bun.serve({
    port: '{{PORT_EXEMPLE}}',
    fetch(req: Request): Response {
      const response = handleExemploRequest(req);
      return response ?? new Response('Não encontrado', { status: 404 });
    },
  });

  console.log(`Servidor do Exemplo rodando em ${server.url.href}`);
}
