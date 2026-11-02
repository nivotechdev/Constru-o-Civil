// O IP de quem chamou, para os limites de taxa (AUD-005). O primeiro item de `x-forwarded-for` é escrito pelo
// próprio cliente e muda a cada chamada; por isso a ordem é: o cabeçalho que a borda (Cloudflare) escreve
// (`cf-connecting-ip`), depois `x-real-ip` e, só então, o ÚLTIMO item de `x-forwarded-for` (o que o nosso proxy
// acrescentou). Valor que não parece um IP é ignorado, para a chave do limite não crescer sem fim.
const LOOKS_LIKE_IP = /^[0-9a-fA-F:.]{2,45}$/;

export function clientIp(req: Request): string {
  const single = (name: string) => (req.headers.get(name) ?? '').trim();
  for (const name of ['cf-connecting-ip', 'x-real-ip']) {
    const value = single(name);
    if (LOOKS_LIKE_IP.test(value)) return value;
  }
  const hops = single('x-forwarded-for')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  const last = hops[hops.length - 1] ?? '';
  return LOOKS_LIKE_IP.test(last) ? last : 'desconhecido';
}
