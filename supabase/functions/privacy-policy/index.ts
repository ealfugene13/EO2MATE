Deno.serve(()=>{
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Privacy Policy</title>
</head>
<body>
  <h1>Privacy Policy</h1>

  <p>Auction Automation privacy policy.</p>

  <h2>Data Collection</h2>
  <p>
    This application processes Facebook Page information necessary
    to provide auction automation services.
  </p>

  <h2>Data Deletion</h2>
  <p>
    Users may request deletion of their data by contacting the
    application owner.
  </p>

  <h2>Contact</h2>
  <p>
    Please contact the application owner for privacy-related requests.
  </p>
</body>
</html>
`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
});
