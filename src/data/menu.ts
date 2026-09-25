import { MenuItem } from "@/store/useCartStore";

export const CATEGORIES = [
  "All",
  "Healthy Mania",
  "Double Healthy Mania",
  "Indian Tadka Pizza",
  "Medium Pizzas",
  "Large Pizzas",
  "Subs",
  "Fries",
  "Bowls",
  "Burgers",
  "Sides",
  "Desserts",
  "Beverages",
  "Extra Toppings",
];

export const DUMMY_MENU: MenuItem[] = [
  /* ============================================================
     HEALTHY MANIA
     ============================================================ */
  {
    id: "hm1",
    name: "Onion Pizza",
    description:
      "Classic whole wheat pizza topped with fresh caramelised onions. 100% no Maida, no palm oil.",
    price: 99,
    category: "Healthy Mania",
    imageUrl:
      "https://6aa2af33ea08b9137fd58d43.imgix.net/sandbox/pngtree-d-pizza-with-onion-rings-and-cubed-cheese-isolated-on-transparent-png-image_18967346.png",
    available: true,
    isVeg: true,
  },
  {
    id: "hm2",
    name: "Tomato Pizza",
    description:
      "Fresh farm tomatoes on a wholesome whole wheat base with premium mozzarella cheese.",
    price: 99,
    category: "Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "hm3",
    name: "Soya Pizza",
    description:
      "Protein-rich soya chunks on a healthy whole wheat crust — perfect post-workout meal.",
    price: 119,
    category: "Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "hm4",
    name: "Golden Corn Pizza",
    description:
      "Sweet golden corn kernels on a wholesome whole wheat pizza base with melting cheese.",
    price: 119,
    category: "Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "hm5",
    name: "Capsicum Pizza",
    description:
      "Crispy capsicum and colourful bell peppers on a healthy whole wheat base.",
    price: 119,
    category: "Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "hm6",
    name: "Margherita Pizza",
    description:
      "Classic Margherita with farm-fresh tomato sauce and premium mozzarella on whole wheat.",
    price: 129,
    category: "Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     DOUBLE HEALTHY MANIA
     ============================================================ */
  {
    id: "dhm1",
    name: "Paneer, Onion & Capsicum Pizza",
    description:
      "A wholesome combo of fresh paneer, crispy onions and colourful capsicum on whole wheat.",
    price: 139,
    category: "Double Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "dhm2",
    name: "Onion & Capsicum Pizza",
    description:
      "Classic combination of sweet onions and fresh capsicum on a healthy whole wheat crust.",
    price: 129,
    category: "Double Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "dhm3",
    name: "Capsicum & Paprika Pizza",
    description:
      "Smoky paprika spice with fresh capsicum on a healthy whole wheat base.",
    price: 129,
    category: "Double Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "dhm4",
    name: "Fresh Veggie Pizza",
    description:
      "Loaded with capsicum, onion, tomato and mushroom on a wholesome whole wheat base.",
    price: 139,
    category: "Double Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "dhm5",
    name: "Double Margherita Pizza",
    description:
      "Double the cheese, double the love — premium mozzarella loaded Margherita on whole wheat.",
    price: 149,
    category: "Double Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "dhm6",
    name: "Farmhouse Pizza",
    description:
      "A hearty mix of farm-fresh veggies on a whole wheat crust — freshly baked to perfection.",
    price: 179,
    category: "Double Healthy Mania",
    imageUrl:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     INDIAN TADKA PIZZA
     ============================================================ */
  {
    id: "itp1",
    name: "Paneer Makhani Pizza",
    description:
      "Rich, creamy makhani sauce with soft paneer cubes on a whole wheat base.",
    price: 149,
    category: "Indian Tadka Pizza",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "itp2",
    name: "Spicy Harissa Pizza",
    description:
      "Bold North African harissa sauce with fresh toppings on a whole wheat crust. 🌶️",
    price: 149,
    category: "Indian Tadka Pizza",
    imageUrl:
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "itp3",
    name: "Kadhai Paneer Pizza",
    description:
      "Spiced kadhai paneer masala with peppers and onions on a healthy whole wheat base.",
    price: 149,
    category: "Indian Tadka Pizza",
    imageUrl:
      "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "itp4",
    name: "Peri Peri Paneer Pizza",
    description:
      "Fiery peri peri sauce with juicy paneer on a whole wheat base. 🌶️",
    price: 169,
    category: "Indian Tadka Pizza",
    imageUrl:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "itp5",
    name: "Mushroom Pizza",
    description:
      "Earthy button mushrooms with herbs and cheese on a healthy whole wheat crust.",
    price: 169,
    category: "Indian Tadka Pizza",
    imageUrl:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "itp6",
    name: "EL PRESTO SPECIAL",
    description:
      "Chef's special — a secret blend of premium toppings on a whole wheat base. Our signature pizza! ⭐",
    price: 199,
    category: "Indian Tadka Pizza",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     MEDIUM PIZZAS (9 INCH)
     ============================================================ */
  {
    id: "mp1",
    name: "Veggie Supreme Pizza (Medium)",
    description:
      "A 9-inch fully loaded pizza with premium vegetables on a whole wheat base.",
    price: 299,
    category: "Medium Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "mp2",
    name: "Paneer Makhani Pizza (Medium)",
    description:
      "Medium version of our signature creamy makhani paneer pizza on whole wheat.",
    price: 319,
    category: "Medium Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "mp3",
    name: "Cheese Burst Margherita (Medium)",
    description:
      "Medium cheese-burst Margherita — oozing with mozzarella on whole wheat.",
    price: 339,
    category: "Medium Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "mp4",
    name: "El Presto Special (Medium)",
    description:
      "Our chef's special medium pizza with the signature secret blend of premium toppings.",
    price: 369,
    category: "Medium Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "mp5",
    name: "Peri Peri Paneer Loaded Pizza (Medium)",
    description:
      "Medium fiery peri peri pizza loaded with extra paneer on a whole wheat base.",
    price: 339,
    category: "Medium Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "mp6",
    name: "Golden Corn & Cheese Feast (Medium)",
    description:
      "Medium golden corn pizza with a generous cheese feast on a whole wheat base.",
    price: 289,
    category: "Medium Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "mp7",
    name: "Famous Farmhouse (Medium)",
    description:
      "Our famous farmhouse medium pizza with hearty farm-fresh vegetables.",
    price: 319,
    category: "Medium Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "mp8",
    name: "Spicy Harissa (Medium)",
    description:
      "Medium spicy harissa pizza with bold flavours on a whole wheat base.",
    price: 279,
    category: "Medium Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     LARGE PIZZAS (12 INCH)
     ============================================================ */
  {
    id: "lp1",
    name: "Veggie Supreme Pizza (Large)",
    description:
      "A large 12-inch fully loaded pizza with premium vegetables on a whole wheat base.",
    price: 419,
    category: "Large Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "lp2",
    name: "Paneer Makhani Pizza (Large)",
    description:
      "Large version of our signature creamy makhani paneer pizza on whole wheat.",
    price: 439,
    category: "Large Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "lp3",
    name: "Cheese Burst Margherita (Large)",
    description:
      "Large cheese-burst Margherita — oozing with mozzarella on whole wheat.",
    price: 459,
    category: "Large Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "lp4",
    name: "El Presto Special (Large)",
    description:
      "Our chef's special large pizza with the signature secret blend of premium toppings.",
    price: 499,
    category: "Large Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "lp5",
    name: "Peri Peri Paneer Loaded Pizza (Large)",
    description:
      "Large fiery peri peri pizza loaded with extra paneer on a whole wheat base.",
    price: 449,
    category: "Large Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "lp6",
    name: "Golden Corn & Cheese Feast (Large)",
    description:
      "Large golden corn pizza with a generous cheese feast on a whole wheat base.",
    price: 399,
    category: "Large Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "lp7",
    name: "Famous Farmhouse (Large)",
    description:
      "Our famous farmhouse large pizza with hearty farm-fresh vegetables.",
    price: 419,
    category: "Large Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "lp8",
    name: "Spicy Harissa (Large)",
    description:
      "Large spicy harissa pizza with bold flavours on a whole wheat base.",
    price: 399,
    category: "Large Pizzas",
    imageUrl:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     SUBS
     ============================================================ */
  {
    id: "sub1",
    name: "Veg Sub",
    description:
      "Fresh vegetables loaded into a soft sub bun with our signature sauces.",
    price: 79,
    category: "Subs",
    imageUrl:
      "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "sub2",
    name: "Veg Cheese Sub",
    description:
      "Fresh vegetables with melted cheese in a soft, warm sub bun.",
    price: 99,
    category: "Subs",
    imageUrl:
      "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "sub3",
    name: "Paneer Sub",
    description:
      "Tender spiced paneer in a soft sub bun with fresh veggies and creamy sauce.",
    price: 119,
    category: "Subs",
    imageUrl:
      "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "sub4",
    name: "Paneer Cheese Sub",
    description:
      "Spiced paneer with melted cheese in a soft sub bun — a cheesy delight.",
    price: 139,
    category: "Subs",
    imageUrl:
      "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     FRIES
     ============================================================ */
  {
    id: "fr1",
    name: "Salted Fries",
    description:
      "Classic crispy golden fries with a sprinkle of sea salt.",
    price: 59,
    category: "Fries",
    imageUrl:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "fr2",
    name: "Peri Peri Fries",
    description:
      "Golden fries tossed in our signature peri peri spice blend. 🌶️",
    price: 69,
    category: "Fries",
    imageUrl:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "fr3",
    name: "Saucy Fries",
    description:
      "Crispy fries drizzled with our special tangy house sauce.",
    price: 89,
    category: "Fries",
    imageUrl:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "fr4",
    name: "Cheesy Fries",
    description:
      "Golden fries smothered in creamy melted cheese sauce.",
    price: 99,
    category: "Fries",
    imageUrl:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     BOWLS
     ============================================================ */
  {
    id: "bw1",
    name: "Veggie Bowl",
    description:
      "A wholesome bowl of fresh seasonal vegetables with grains and house dressing.",
    price: 89,
    category: "Bowls",
    imageUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "bw2",
    name: "Mexican Paneer Bowl",
    description:
      "Spiced paneer with Mexican-style salsa, corn and fresh toppings in a bowl.",
    price: 109,
    category: "Bowls",
    imageUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "bw3",
    name: "Peri Peri Paneer Bowl",
    description:
      "Fiery peri peri paneer with fresh greens and grains in a bowl. 🌶️",
    price: 119,
    category: "Bowls",
    imageUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     BURGERS
     ============================================================ */
  {
    id: "bg1",
    name: "Fresh Veg Burger",
    description:
      "A fresh and crispy veggie patty burger with lettuce, tomato and sauces.",
    price: 69,
    category: "Burgers",
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "bg2",
    name: "Protein Power Burger",
    description:
      "High-protein patty burger packed with wholesome ingredients for the fitness lover.",
    price: 79,
    category: "Burgers",
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "bg3",
    name: "Muscle Meal Burger",
    description:
      "Extra protein, extra flavour — the ultimate muscle meal burger.",
    price: 89,
    category: "Burgers",
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "bg4",
    name: "Paneer Deluxe Burger",
    description:
      "Juicy spiced paneer patty with cheese and fresh veggies in a soft bun.",
    price: 99,
    category: "Burgers",
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     SIDES
     ============================================================ */
  {
    id: "sd1",
    name: "Garlic Bread",
    description:
      "Crispy toasted garlic bread with herbs and butter.",
    price: 79,
    category: "Sides",
    imageUrl:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "sd2",
    name: "Stuffed Garlic Bread",
    description:
      "Garlic bread stuffed with cheese and herbs — oozy and delicious.",
    price: 139,
    category: "Sides",
    imageUrl:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "sd3",
    name: "Paneer Stuffed Garlic Bread",
    description:
      "Garlic bread generously stuffed with spiced paneer and herbs.",
    price: 149,
    category: "Sides",
    imageUrl:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "sd4",
    name: "Cheese Garlic Bread",
    description:
      "Garlic bread loaded with melted mozzarella cheese on top.",
    price: 109,
    category: "Sides",
    imageUrl:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "sd5",
    name: "Zingy Parcel",
    description:
      "A tangy, zingy snack parcel with our signature spice blend.",
    price: 39,
    category: "Sides",
    imageUrl:
      "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     DESSERTS
     ============================================================ */
  {
    id: "ds1",
    name: "Choco Lava",
    description:
      "Warm chocolate lava cake with a gooey molten centre.",
    price: 49,
    category: "Desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "ds2",
    name: "Brownie",
    description:
      "Rich and fudgy homemade chocolate brownie.",
    price: 49,
    category: "Desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "ds3",
    name: "Brownie with Ice Cream",
    description:
      "Warm fudgy brownie served with a scoop of creamy vanilla ice cream.",
    price: 69,
    category: "Desserts",
    imageUrl:
      "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     BEVERAGES
     ============================================================ */
  {
    id: "bv1",
    name: "Cold Coffee",
    description:
      "Healthy, refreshing cold coffee — no refined sugar, 100% vegetarian. A guilt-free energy boost! ☕",
    price: 60,
    category: "Beverages",
    imageUrl:
      "https://i.ibb.co/Y4dqh2cC/FAINAL-MENU-CAMPUS.png",
    available: true,
    isVeg: true,
  },
  {
    id: "bv2",
    name: "Sattu Drink",
    description:
      "Traditional Indian sattu drink — cooling, protein-rich and naturally refreshing.",
    price: 40,
    category: "Beverages",
    imageUrl:
      "https://images.unsplash.com/photo-1517093602195-b40af9688b46?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "bv3",
    name: "Soft Drink",
    description:
      "Chilled soft drink to go with your meal. Priced at MRP.",
    price: 20,
    category: "Beverages",
    imageUrl:
      "https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=600&q=80",
    available: true,
    isVeg: true,
  },

  /* ============================================================
     EXTRA TOPPINGS
     ============================================================ */
  {
    id: "et1",
    name: "Veggie Toppings Combo",
    description:
      "Choose any: Onion, Tomato, Corn or Capsicum. Fresh add-ons for your pizza.",
    price: 10,
    category: "Extra Toppings",
    imageUrl:
      "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "et2",
    name: "Premium Toppings Combo",
    description:
      "Choose any: Jalapeño, Paprika, Mushroom or extra Paneer.",
    price: 20,
    category: "Extra Toppings",
    imageUrl:
      "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80",
    available: true,
    isVeg: true,
  },
  {
    id: "et3",
    name: "Extra Cheese",
    description:
      "A generous layer of premium mozzarella cheese to top it all off.",
    price: 30,
    category: "Extra Toppings",
    imageUrl:
      "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&q=80",
    available: true,
    isVeg: true,
  },
];