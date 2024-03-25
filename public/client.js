const fillInTypes = async () => {
    document.querySelector("#get-type").innerHTML = "";
    const response = await fetch("/types");
    const types = await response.json();
    types.forEach(type =>
      document
        .querySelector("#get-type")
        .insertAdjacentHTML(
          "beforeend",
          `<option value=${type[0]} data-spm=${type[2]}>${type[1]} ${
            type[2] !== "n/a" ? `(${type[2]})` : ""
          }</option>`
        )
    );
  };
  fillInTypes();
  
  const fillInShops = async () => {
    const response = await fetch("/shops");
    const [shopNames, shopCodes] = await response.json();
    shopNames.forEach((shop, i) => {
      document
        .querySelector(".modal-inside table")
        .insertAdjacentHTML(
          "beforeend",
          `<tr><td>${shopCodes[i]}</td><td>${shop}</td></tr>`
        );
      document
        .querySelector("#shop")
        .insertAdjacentHTML(
          "beforeend",
          `<option value=${shopCodes[i]}>${shop}</option>`
        );
      document
        .querySelector("#get-shop")
        .insertAdjacentHTML(
          "beforeend",
          `<option value=${shopCodes[i]}>${shop}</option>`
        );
    });
  };
  fillInShops();
  
  document.querySelector("#get-all-prices").onsubmit = async () => {
    event.preventDefault();
    const id = document.querySelector("#get-type").value;
    if (id) {
      document.querySelector("#all-prices").innerHTML = `Searching...`;
      const response = await fetch(`/all-prices?id=${id}`);
      const data = await response.json();
      if (data) {
        document.querySelector(
          "#all-prices"
        ).innerHTML = `<h6>Out-of-date prices are crossed out</h6><h6>To mark a price as out of date, or to undo, click on the row</h6><h6>To see a list of all the shops, click on the 'Shop' heading below</h6><div class="row"><span class="cell"><b>Product</b></span><span class="cell"><b>Deal</b></span><span class="cell"><b>Price</b></span><span class="cell"><b>Size</b></span><span class="cell"><b>S. price</b></span><span class="cell shop-lookup"><b>Shop</b></span><span class="cell"><b>When submitted</b></span><span class="cell"><b>By user</b></span></div>${data}`;
        const prices = document
          .querySelector("#all-prices")
          .querySelectorAll(".price");
        for (const price of prices) {
          if (price.getAttribute("data-live") === "false") {
            price.classList.add("dead-price");
          }
          price.addEventListener("click", () => {
            event.preventDefault();
            price.classList.toggle("dead-price");
            fetch("/toggle-live", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: price.getAttribute("data-id") })
            }).catch(error => console.log(error));
          });
        }
        document.querySelector(".shop-lookup").onclick = () => {
          document.querySelector(".modal").classList.remove("hidden");
          document.querySelector(".modal-close").onclick = () => {
            document.querySelector(".modal").classList.add("hidden");
          };
        };
        document
          .querySelector("#hidden-delete-section")
          .classList.remove("hidden");
        document.querySelector("#delete").onsubmit = () => {
          event.preventDefault();
          const password = document.querySelector("#password").value;
          fetch("/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: password, id: id })
          })
            .then(response => response.json())
            .then(data => {
              document.querySelector("#delete-confirm").innerHTML = `${data}`;
              document.querySelector("#password").value = "";
            })
            .catch(error => console.log(error));
        };
      } else {
        document.querySelector("#all-prices").innerHTML = `No prices found`;
        document.querySelector("#delete-confirm").innerHTML = "";
        document.querySelector("#hidden-delete-section").classList.add("hidden");
      }
      document.querySelector(
        "#standardised-price"
      ).placeholder = document
        .querySelector("#get-type")
        .options[document.querySelector("#get-type").selectedIndex].getAttribute(
          "data-spm"
        );
    }
  };
  
  document.querySelector("#submit-product").onsubmit = async () => {
    event.preventDefault();
    const type = document.querySelector("#generic-product").value.toLowerCase();
    const SPM = document.querySelector("#standard-price-measurement").value;
    const response = await fetch("/types");
    const types = await response.json();
    if (types.map(v => v[1]).indexOf(type) === -1) {
      const body = { type, SPM };
      fetch("/submit-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
        .then(response => response.json())
        .then(async id => {
          await fillInTypes();
          document.querySelector("#get-type").value = id;
          document
            .querySelector("#get-all-prices")
            .dispatchEvent(new Event("submit"));
          document.querySelector(
            "#product-confirm"
          ).innerHTML = `'${Object.values(
            body
          )}' is now in the database and selected`;
        })
        .catch(error => console.log(error));
    } else {
      document.querySelector(
        "#product-confirm"
      ).innerHTML = `'${type}' is in the database already`;
    }
  };
  
  const workOutStandardisedPrice = (price, size, SPM) => {
    let standardisedPrice = price;
    const lowerCaseSize = size.toLowerCase();
    let beforeX, afterX;
    let quantity1, quantity2, unitArray, unit;
    if (/x/.test(lowerCaseSize)) {
      [beforeX, afterX] = lowerCaseSize.split("x");
      quantity1 = parseFloat(beforeX);
    } else {
      quantity1 = 1;
      afterX = lowerCaseSize;
    }
    quantity2 = parseFloat(afterX);
    unitArray = afterX.match(/[a-z][\sa-z]*/);
    unit = unitArray ? unitArray[0] : "";
    let penceOrPound, SPMUnit;
    [penceOrPound, SPMUnit] = SPM.split("/");
    if (penceOrPound === "p") {
      price = price * 100;
    }
    switch (SPMUnit) {
      case "kg":
      case "ltr":
        if (/^g|^m/.test(unit)) {
          quantity2 = quantity2 / 1000;
        }
        break;
      case "100g":
      case "100ml":
        if (/^k|^l/.test(unit)) {
          quantity2 = quantity2 * 10;
        }
        if (/^g|^m/.test(unit)) {
          quantity2 = quantity2 / 100;
        }
        break;
      case "g":
      case "ml":
        if (/^k|^l/.test(unit)) {
          quantity2 = quantity2 * 1000;
        }
        break;
      case "100_sheets":
        quantity2 = quantity2 / 100;
        break;
    }
    standardisedPrice =
      Math.round((10000 * price) / (quantity1 * quantity2)) / 10000;
    return standardisedPrice;
  };
  
  document.querySelector("#standardised-price").onfocus = () => {
    const price = parseFloat(document.querySelector("#price").value);
    const size = document.querySelector("#size").value;
    const SPM = document
      .querySelector("#get-type")
      .options[document.querySelector("#get-type").selectedIndex].getAttribute(
        "data-spm"
      );
    if (price >= 0 && size) {
      document.querySelector(
        "#standardised-price"
      ).value = workOutStandardisedPrice(price, size, SPM);
    }
  };
  
  document.querySelector("#submit-price").onsubmit = () => {
    event.preventDefault();
    const id = document.querySelector("#get-type").value;
    const product = document
      .querySelector("#specific-product")
      .value.toLowerCase();
    const deal = document.querySelector("#deal").value;
    const price = parseFloat(document.querySelector("#price").value);
    const size = document.querySelector("#size").value;
    const sPrice = parseFloat(
      document.querySelector("#standardised-price").value
    );
    const shop = document.querySelector("#shop").value;
    const user = document.querySelector("#user").value;
    const body = { id, product, deal, price, size, sPrice, shop, user };
    fetch("/submit-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(() => {
        document
          .querySelector("#get-all-prices")
          .dispatchEvent(new Event("submit"));
        document.querySelector("#price-confirm").innerHTML = `'${Object.values(
          body
        )}' is now in the database`;
      })
      .catch(error => console.log(error));
  };
  
  document.querySelector("#search").onsubmit = async () => {
    event.preventDefault();
    document.querySelector("#search-results").innerHTML = `Searching...`;
    const url = `/search?term=${document.querySelector("#search-term").value}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data) {
      document.querySelector(
        "#search-results"
      ).innerHTML = `<div class="row"><span class="cell"><b>Category</b></span><span class="cell"><b>Product</b></span><span class="cell"><b>Deal</b></span><span class="cell"><b>Price</b></span><span class="cell"><b>Size</b></span><span class="cell"><b>S. price</b></span><span class="cell"><b>Shop</b></span><span class="cell"><b>When submitted</b></span><span class="cell"><b>By user</b></span></div>${data}`;
      const prices = document
        .querySelector("#search-results")
        .querySelectorAll(".price");
      for (const price of prices) {
        if (price.getAttribute("data-live") === "false") {
          price.classList.add("dead-price");
        }
      }
    } else {
      document.querySelector("#search-results").innerHTML = `No results found`;
    }
  };
  
  document.querySelector("#get-shop-prices").onsubmit = async () => {
    event.preventDefault();
    document.querySelector("#shop-prices").innerHTML = `Searching...`;
    const response = await fetch(
      `/shop-prices?code=${document.querySelector("#get-shop").value}`
    );
    const data = await response.json();
    if (data) {
      document.querySelector(
        "#shop-prices"
      ).innerHTML = `<div class="row"><span class="cell"><b>Category</b></span><span class="cell"><b>Product</b></span><span class="cell"><b>Deal</b></span><span class="cell"><b>Price</b></span><span class="cell"><b>Size</b></span><span class="cell"><b>S. price</b></span><span class="cell"><b>Shop</b></span><span class="cell"><b>When submitted</b></span><span class="cell"><b>By user</b></span></div>${data}`;
      const prices = document
        .querySelector("#shop-prices")
        .querySelectorAll(".price");
      for (const price of prices) {
        if (price.getAttribute("data-live") === "false") {
          price.classList.add("dead-price");
        }
      }
    } else {
      document.querySelector("#shop-prices").innerHTML = `No results found`;
    }
  };
  