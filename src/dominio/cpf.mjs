// Validação de CPF com o mesmo algoritmo do value object Documento da API
// (GearUp.Domain/ValueObjects/Clientes/Documento.cs), para que um CPF aceito
// aqui seja exatamente o que está gravado na coluna "Clientes"."Documento".

const FORMATO_ACEITO = /^[\d.\-\s]+$/;

export function somenteDigitos(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return '';
  return String(valor).replace(/\D/g, '');
}

function calcularDigito(base, pesoInicial) {
  let soma = 0;
  for (let indice = 0; indice < base.length; indice++) {
    soma += Number(base[indice]) * (pesoInicial - indice);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(valor) {
  if (typeof valor === 'string' && !FORMATO_ACEITO.test(valor)) return false;

  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  return calcularDigito(cpf.slice(0, 9), 10) === Number(cpf[9])
    && calcularDigito(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

// LGPD: CPF nunca vai inteiro para os logs.
export function mascararCpf(cpf) {
  const digitos = somenteDigitos(cpf);
  if (digitos.length !== 11) return '***';
  return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
}
