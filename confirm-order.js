// Netlify Function: se llama SOLO después de que Wompi confirma un pago
// aprobado. Usa la Service Role Key de Supabase (nunca expuesta al
// navegador) para:
//   1. Descontar el stock de cada producto comprado.
//   2. Si se usó un código de descuento, sumarle 1 a su contador de usos.
//
// Requiere las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// configuradas en Netlify (Site configuration > Environment variables).

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON inválido" }) };
  }

  const { items, discountCode } = payload;
  // items esperado: [{ productId: "gel-1", qty: 2 }, ...]

  if (!Array.isArray(items) || items.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Falta la lista de productos comprados (items)." }),
    };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Faltan configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify.",
      }),
    };
  }

  const headers = {
    apikey: SERVICE_KEY,
    Authorization: "Bearer " + SERVICE_KEY,
    "Content-Type": "application/json",
  };

  const results = { stockUpdates: [], discountUpdated: false, errors: [] };

  // 1. Descuenta el stock de cada producto comprado.
  for (const item of items) {
    try {
      // Trae el stock actual del producto.
      const getRes = await fetch(
        SUPABASE_URL + "/rest/v1/inventario?product_id=eq." + encodeURIComponent(item.productId) + "&select=id,stock",
        { headers }
      );
      const rows = await getRes.json();
      if (!getRes.ok || !Array.isArray(rows) || rows.length === 0) {
        results.errors.push("No se encontró inventario para " + item.productId);
        continue;
      }
      const current = rows[0];
      const newStock = Math.max(0, current.stock - item.qty);

      const updateRes = await fetch(
        SUPABASE_URL + "/rest/v1/inventario?id=eq." + current.id,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ stock: newStock }),
        }
      );
      if (!updateRes.ok) {
        results.errors.push("No se pudo actualizar stock de " + item.productId);
        continue;
      }
      results.stockUpdates.push({ productId: item.productId, newStock });
    } catch (err) {
      results.errors.push("Error actualizando " + item.productId + ": " + err.message);
    }
  }

  // 2. Si se usó un código de descuento, súmale 1 a current_uses.
  if (discountCode) {
    try {
      const getRes = await fetch(
        SUPABASE_URL + "/rest/v1/discount_code?code=eq." + encodeURIComponent(discountCode) + "&select=id,current_uses",
        { headers }
      );
      const rows = await getRes.json();
      if (getRes.ok && Array.isArray(rows) && rows.length > 0) {
        const current = rows[0];
        const updateRes = await fetch(
          SUPABASE_URL + "/rest/v1/discount_code?id=eq." + current.id,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({ current_uses: (current.current_uses || 0) + 1 }),
          }
        );
        results.discountUpdated = updateRes.ok;
      }
    } catch (err) {
      results.errors.push("Error actualizando código de descuento: " + err.message);
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(results),
  };
};
