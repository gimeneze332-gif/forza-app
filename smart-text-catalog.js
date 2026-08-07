/* FORZA Smart Text: catálogo local. Sin red, APIs ni dependencias externas. */
(function (root) {
    "use strict";

    const food = (id, name, aliases, nutrition, defaultQuantity, measures = {}, preparations = []) => ({
        id, name, aliases, nutrition, defaultQuantity, measures, preparations
    });

    const catalog = [
        food("egg", "Huevo", ["huevo", "huevos"], { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 }, { value: 1, unit: "unit", grams: 50 }, { unit: 50 }, ["hervido", "frito", "revuelto"]),
        food("tomato", "Tomate", ["tomate", "tomates"], { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 }, { value: 1, unit: "unit", grams: 120 }, { unit: 120, slice: 20, cup: 180 }),
        food("banana", "Banana", ["banana", "bananas", "platano"], { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 }, { value: 1, unit: "unit", grams: 118 }, { unit: 118, slice: 12, cup: 150 }),
        food("apple", "Manzana", ["manzana", "manzanas"], { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2 }, { value: 1, unit: "unit", grams: 180 }, { unit: 180, slice: 18, cup: 125 }),
        food("yogurt", "Yogur", ["yogur", "yogurt", "yogures"], { calories: 72, protein: 4, carbs: 9.6, fat: 2 }, { value: 1, unit: "portion", grams: 125 }, { portion: 125, cup: 245, tbsp: 15 }),
        food("milk", "Leche", ["leche"], { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 }, { value: 1, unit: "glass", grams: 200 }, { glass: 200, cup: 240, tbsp: 15, tsp: 5 }),
        food("oats", "Avena", ["avena"], { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9 }, { value: 40, unit: "g", grams: 40 }, { cup: 80, tbsp: 10, tsp: 3 }),
        food("granola", "Granola", ["granola"], { calories: 471, protein: 10, carbs: 64, fat: 20 }, { value: 30, unit: "g", grams: 30 }, { cup: 100, tbsp: 8, tsp: 3 }),
        food("rice_cooked", "Arroz cocido", ["arroz", "arroz cocido"], { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 }, { value: 150, unit: "g", grams: 150 }, { cup: 195, tbsp: 12, portion: 180 }),
        food("chicken", "Pollo", ["pollo", "pechuga", "pechuga de pollo"], { calories: 165, protein: 31, carbs: 0, fat: 3.6 }, { value: 150, unit: "g", grams: 150 }, { cup: 140, portion: 150 }, ["plancha", "horno", "hervido"]),
        food("beef", "Carne vacuna", ["carne", "carne vacuna", "bife"], { calories: 250, protein: 26, carbs: 0, fat: 15 }, { value: 150, unit: "g", grams: 150 }, { portion: 150 }, ["plancha", "horno"]),
        food("tuna", "Atún", ["atun", "atún"], { calories: 116, protein: 26, carbs: 0, fat: 1 }, { value: 1, unit: "portion", grams: 120 }, { portion: 120, cup: 150 }),
        food("toast", "Tostada", ["tostada", "tostadas", "pan tostado"], { calories: 266, protein: 9, carbs: 49, fat: 3.2 }, { value: 1, unit: "unit", grams: 30 }, { unit: 30, slice: 30 }),
        food("bread", "Pan", ["pan", "rodaja de pan", "rebanada de pan"], { calories: 266, protein: 9, carbs: 49, fat: 3.2 }, { value: 1, unit: "slice", grams: 30 }, { unit: 30, slice: 30 }),
        food("mashed_potato", "Puré de papa", ["pure", "puré", "pure de papa", "puré de papa"], { calories: 113, protein: 2, carbs: 17, fat: 4.2 }, { value: 1, unit: "portion", grams: 200 }, { cup: 210, tbsp: 15, portion: 200 }),
        food("fries", "Papas fritas", ["papas fritas", "papas", "fritas"], { calories: 312, protein: 3.4, carbs: 41, fat: 15 }, { value: 1, unit: "portion", grams: 150 }, { portion: 150, cup: 120 }, ["fritas"]),
        food("milanesa_beef", "Milanesa de carne", ["milanesa de carne"], { calories: 270, protein: 22, carbs: 15, fat: 14 }, { value: 1, unit: "unit", grams: 150 }, { unit: 150, portion: 150 }, ["horno", "frita"]),
        food("milanesa_chicken", "Milanesa de pollo", ["milanesa de pollo"], { calories: 240, protein: 25, carbs: 15, fat: 9 }, { value: 1, unit: "unit", grams: 150 }, { unit: 150, portion: 150 }, ["horno", "frita"]),
        food("pizza_mozzarella", "Pizza de mozzarella", ["pizza", "pizza de mozzarella", "pizza muzzarella"], { calories: 266, protein: 11, carbs: 33, fat: 10 }, { value: 2, unit: "portion", grams: 200 }, { portion: 100, slice: 100 }),
        food("hamburger", "Hamburguesa completa", ["hamburguesa", "hamburguesa completa"], { calories: 250, protein: 13, carbs: 25, fat: 11 }, { value: 1, unit: "unit", grams: 220 }, { unit: 220, portion: 220 })
    ];

    const dishes = [
        {
            id: "milanesa_puree",
            aliases: ["milanesa con pure", "milanesa con puré"],
            components: [
                { ambiguous: true, label: "Milanesa", choices: ["milanesa_beef", "milanesa_chicken"] },
                { foodId: "mashed_potato" }
            ]
        },
        {
            id: "hamburger_fries",
            aliases: ["hamburguesa con papas", "hamburguesa con papas fritas"],
            components: [{ foodId: "hamburger" }, { foodId: "fries" }]
        }
    ];

    root.ForzaSmartText = {
        __catalog: Object.freeze({
            version: 1,
            foods: Object.freeze(catalog),
            dishes: Object.freeze(dishes)
        })
    };
}(typeof window !== "undefined" ? window : globalThis));
