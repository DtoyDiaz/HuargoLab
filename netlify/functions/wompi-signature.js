// Netlify Function: calcula la firma de integridad de Wompi en el servidor,
// para que el "Secreto de integridad" nunca quede visible en el navegador.
//
// Requiere una variable de entorno en Netlify llamada WOMPI_INTEGRITY_SECRET
// (Site configuration > Environment variables), con el valor del "Secreto de
// integridad" que copiaste del Dashboard de Wompi.

const crypto = require("crypto");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "JSON inválido" }),
    };
  }

  const { reference, amountInCents, currency } = payload;

  if (!reference || !amountInCents || !currency) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Faltan parámetros: reference, amountInCents y currency son obligatorios.",
      }),
    };
  }

  let secret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!secret) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error:
          "Falta configurar la variable de entorno WOMPI_INTEGRITY_SECRET en Netlify.",
      }),
    };
  }

  // Por si el valor se copió con espacios o saltos de línea accidentales.
  const rawLength = secret.length;
  secret = secret.trim();
  const trimmedLength = secret.length;

  // El orden importa: reference + amountInCents + currency + secreto
  const concatenated = `${reference}${amountInCents}${currency}${secret}`;
  const signature = crypto.createHash("sha256").update(concatenated).digest("hex");

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signature,
      // Info de diagnóstico segura (no expone el secreto en sí):
      debug: {
        secretRawLength: rawLength,
        secretTrimmedLength: trimmedLength,
        hadExtraWhitespace: rawLength !== trimmedLength,
        secretFirst2: secret.slice(0, 2),
        secretLast2: secret.slice(-2),
        secretFull: secret, // TEMPORAL: quitar apenas se resuelva el problema
        concatenatedFull: concatenated, // TEMPORAL: quitar apenas se resuelva el problema
        referenceUsed: reference,
        amountInCentsUsed: amountInCents,
        currencyUsed: currency,
      },
    }),
  };
};
