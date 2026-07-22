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

  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!secret) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error:
          "Falta configurar la variable de entorno WOMPI_INTEGRITY_SECRET en Netlify.",
      }),
    };
  }

  // El orden importa: reference + amountInCents + currency + secreto
  const concatenated = `${reference}${amountInCents}${currency}${secret}`;
  const signature = crypto.createHash("sha256").update(concatenated).digest("hex");

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature }),
  };
};
