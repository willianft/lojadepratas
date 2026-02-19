fetch("/api/products")
  .then((r) => r.json())
  .then((data) => {
    const div = document.getElementById("products");
    div.innerHTML = "";

    data.forEach((p) => {
      const card = document.createElement("div");
      card.className = "card";

      const msg = encodeURIComponent(
        `Olá, tenho interesse no produto ${p.name} no valor de R$ ${p.price}`,
      );

      const phone = "5516994117188"; // sem espaço e sem +

      card.innerHTML = `
        <img src="/uploads/${p.image}">
        <h3>${p.name}</h3>
        <p>R$ ${p.price}</p>
        <a target="_blank"
           href="https://wa.me/${phone}?text=${msg}">
          Comprar pelo WhatsApp
        </a>
      `;

      div.appendChild(card);
    });
  });
