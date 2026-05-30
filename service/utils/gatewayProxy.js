// API_GATEWAY_BASE_URL이 설정되어 있으면 Lambda로 프록시, 없으면 로컬 핸들러(EC2 폴백) 실행
async function proxyOrFallback(req, res, gatewayPath, localHandler) {
  const baseUrl = (process.env.API_GATEWAY_BASE_URL || "").replace(/\/+$/, "");

  if (!baseUrl) {
    return localHandler(req, res);
  }

  try {
    const url = new URL(`${baseUrl}${gatewayPath}`);

    for (const [key, value] of Object.entries(req.query || {})) {
      url.searchParams.set(key, value);
    }

    const options = {
      method: req.method,
      headers: { "Content-Type": "application/json" },
    };

    if (req.method === "POST" || req.method === "PUT") {
      options.body = JSON.stringify(req.body || {});
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.warn("[gatewayProxy] Lambda 호출 실패, EC2 폴백 실행:", error.message);
    return localHandler(req, res);
  }
}

module.exports = { proxyOrFallback };
