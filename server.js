require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

moment.tz.setDefault("Europe/London");

mongoose.connect(process.env.MONGODB_URI);

const Schema = mongoose.Schema;
const typeSchema = new Schema({
	type: String,
	SPM: String,
	products: [
		{
			product: String,
			prices: [
				{
					deal: String,
					price: Number,
					size: String,
					sPrice: Number,
					shop: String,
					time: String,
					user: String,
					live: Boolean
				}
			]
		}
	]
});
const Type = mongoose.model("Type", typeSchema);

const shopNames = [
	"Aldi",
	"ASDA",
	"Boots",
	"Co-op",
	"Home Bargains",
	"Iceland",
	"International Supermarket (E18 1AY)",
	"Lidl",
	"Marks & Spencer",
	"Morrisons",
	"Ocado",
	"Poundland",
	"Poundstretcher",
	"Sainsbury's",
	"Savers",
	"Superdrug",
	"Tesco",
	"Waitrose",
	"Wilko"
];

const shopCodes = [
	"ALDI",
	"ASDA",
	"BOOTS",
	"CO-OP",
	"HOMEB",
	"ILAND",
	"ISE18",
	"LIDL",
	"M&S",
	"MSONS",
	"OCADO",
	"PLAND",
	"PDSTR",
	"SBURY",
	"SAVER",
	"SDRUG",
	"TESCO",
	"WROSE",
	"WILKO"
];

app.get("/", (request, response) => {
	response.sendFile(__dirname + "/views/index.html");
});

app.get("/types", async (request, response) => {
	try {
		const types = await Type.find({}, "type SPM").exec();
		response.send(
			types
				.map(v => [v._id, v.type, v.SPM])
				.sort((a, b) => a[1].localeCompare(b[1]))
		);
	} catch (error) {
		console.log(error);
	}
});

app.get("/shops", (request, response) => {
	response.send([shopNames, shopCodes]);
});

app.get("/all-prices", async (request, response) => {
	try {
		const type = await Type.findOne({ _id: request.query.id }).exec();
		const allPrices = [];
		type.products.forEach(product => {
			product.prices.forEach(price => {
				allPrices.push([
					product.product,
					price.deal,
					price.price,
					price.size,
					price.sPrice,
					type.SPM,
					price.shop,
					price.time,
					price.user,
					price.live,
					price._id
				]);
			});
		});
		allPrices.sort((a, b) => {
			if (a[9] === true && b[9] === false) {
				return -1;
			}
			if (a[9] === false && b[9] === true) {
				return 1;
			}
			if (a[4] < b[4]) {
				return -1;
			}
			if (a[4] > b[4]) {
				return 1;
			}
			if (moment(b[7]).diff(moment(a[7]))) {
				return -1;
			}
			if (moment(a[7]).diff(moment(b[7]))) {
				return 1;
			}
			return 0;
		});
		let html = "";
		allPrices.forEach(
			v =>
				(html += `<div class="row price pointable" data-live=${v[9]} data-id=${
					v[10]
				}><span class="cell">${v[0]}</span><span class="cell">${
					v[1]
				}</span><span class="cell">£${v[2].toFixed(
					2
				)}</span><span class="cell">${v[3]}</span><span class="cell">${v[4]} ${
					v[5]
				}</span><span class="cell">${v[6]}</span><span class="cell">${
					v[7]
				}</span><span class="cell">${v[8]}</span></div>`)
		);
		response.send(JSON.stringify(html));
	} catch (error) {
		console.log(error);
	}
});

app.post("/toggle-live", async (request, response) => {
	try {
		const id = request.body.id;
		const type = await Type.findOne({ "products.prices._id": id }).exec();
		type.products.forEach(product =>
			product.prices.forEach(price => {
				if (price._id == id) {
					const isLive = price.live;
					price.live = !isLive;
				}
			})
		);
		type.save();
		response.end();
	} catch (error) {
		console.log(error);
	}
});

app.post("/delete", async (request, response) => {
	if (request.body.password !== process.env.PASSWORD) {
		response.send(JSON.stringify("The password's wrong"));
	} else {
		try {
			const type = await Type.findOne({ _id: request.body.id }).exec();
			let wasDeleted = false;
			for (let i = 0; i < type.products.length; i++) {
				for (let j = type.products[i].prices.length - 1; j >= 0; j--) {
					if (type.products[i].prices[j].live === false) {
						type.products[i].prices.splice(j, 1);
						wasDeleted = true;
					}
				}
			}
			type.save();
			if (wasDeleted) {
				response.send(
					JSON.stringify("The out-of-date prices have been deleted")
				);
			} else {
				response.send(JSON.stringify("No prices have been deleted"));
			}
		} catch (error) {
			console.log(error);
		}
	}
});

app.post("/submit-product", (request, response) => {
	try {
		const type = request.body.type;
		const SPM = request.body.SPM;
		const newType = new Type({
			type,
			SPM,
			products: []
		});
		newType.save();
		response.send(JSON.stringify(newType._id));
	} catch (error) {
		console.log(error);
	}
});

app.post("/submit-price", async (request, response) => {
	try {
		const id = request.body.id;
		const product = request.body.product;
		const deal = request.body.deal;
		const price = request.body.price;
		const size = request.body.size;
		const sPrice = request.body.sPrice;
		const shop = request.body.shop;
		const time = moment().format("YYYY-MM-DD HH:mm");
		const user = request.body.user;
		const type = await Type.findOne({ _id: id }).exec();
		const products = type.products;
		const existing = products.map(v => v.product);
		if (existing.indexOf(product) === -1) {
			products.push({
				product,
				prices: [{ deal, price, size, sPrice, shop, time, user, live: true }]
			});
		} else {
			products[existing.indexOf(product)].prices.push({
				deal,
				price,
				size,
				sPrice,
				shop,
				time,
				user,
				live: true
			});
		}
		type.save();
		response.end();
	} catch (error) {
		console.log(error);
	}
});

app.get("/search", async (request, response) => {
	if (!request.query.term) {
		response.send(JSON.stringify(""));
	}
	try {
		const regex = new RegExp(request.query.term, "i");
		//console.log(regex);
		const searchResults = await Type.find({
			$or: [
				{ type: regex },
				{ "products.product": regex },
				{ "products.prices.user": regex }
			]
		}).exec();
		const allPrices = [];
		searchResults.forEach(type => {
			type.products.forEach(product => {
				product.prices.forEach(price => {
					const rowArray = [
						type.type,
						product.product,
						price.deal,
						price.price,
						price.size,
						price.sPrice,
						type.SPM,
						price.shop,
						price.time,
						price.user,
						price.live
					];
					if (
						regex.test(rowArray[0]) ||
						regex.test(rowArray[1]) ||
						regex.test(rowArray[9])
					) {
						allPrices.push(rowArray);
					}
				});
			});
		});
		allPrices.sort((a, b) => moment(b[8]).diff(moment(a[8])));
		let html = "";
		allPrices.forEach(
			v =>
				(html += `<div class="row price" data-live=${
					v[10]
				}><span class="cell">${v[0]}</span><span class="cell">${
					v[1]
				}</span><span class="cell">${
					v[2]
				}</span><span class="cell">£${v[3].toFixed(
					2
				)}</span><span class="cell">${v[4]}</span><span class="cell">${v[5]} ${
					v[6]
				}</span><span class="cell">${v[7]}</span><span class="cell">${
					v[8]
				}</span><span class="cell">${v[9]}</span></div>`)
		);
		response.send(JSON.stringify(html));
	} catch (error) {
		console.log(error);
	}
});

app.get("/shop-prices", async (request, response) => {
	try {
		const code = request.query.code;
		const searchResults = await Type.find({
			"products.prices.shop": code
		}).exec();
		const allPrices = [];
		searchResults.forEach(type => {
			type.products.forEach(product => {
				product.prices.forEach(price => {
					const rowArray = [
						type.type,
						product.product,
						price.deal,
						price.price,
						price.size,
						price.sPrice,
						type.SPM,
						price.shop,
						price.time,
						price.user,
						price.live
					];
					if (rowArray[7] === code) {
						allPrices.push(rowArray);
					}
				});
			});
		});
		allPrices.sort((a, b) => moment(b[8]).diff(moment(a[8])));
		let html = "";
		allPrices.forEach(
			v =>
				(html += `<div class="row price" data-live=${
					v[10]
				}><span class="cell">${v[0]}</span><span class="cell">${
					v[1]
				}</span><span class="cell">${
					v[2]
				}</span><span class="cell">£${v[3].toFixed(
					2
				)}</span><span class="cell">${v[4]}</span><span class="cell">${v[5]} ${
					v[6]
				}</span><span class="cell">${v[7]}</span><span class="cell">${
					v[8]
				}</span><span class="cell">${v[9]}</span></div>`)
		);
		response.send(JSON.stringify(html));
	} catch (error) {
		console.log(error);
	}
});

app.listen(3020, () => {
	console.log("Listening on port 3020");
});
