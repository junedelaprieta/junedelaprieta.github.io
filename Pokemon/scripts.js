const searchBtn = document.getElementById("search-btn");
const clearBtn = document.getElementById("clear-btn");
const searchInput = document.getElementById("search");
const pokemonInfo = document.getElementById("pokemon-info");
const typeCells = document.querySelectorAll(".type-cell");

// 📘 Diccionario inglés → español
const typeTranslations = {
  normal: "Normal",
  fire: "Fuego",
  water: "Agua",
  electric: "Eléctrico",
  grass: "Planta",
  ice: "Hielo",
  fighting: "Lucha",
  poison: "Veneno",
  ground: "Tierra",
  flying: "Volador",
  psychic: "Psíquico",
  bug: "Bicho",
  rock: "Roca",
  ghost: "Fantasma",
  dragon: "Dragón",
  dark: "Siniestro",
  steel: "Acero",
  fairy: "Hada",
};

// 🔍 Buscar Pokémon o tipo
searchBtn.addEventListener("click", async () => {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) return;

  // Si es un tipo (en español o inglés)
  const typeInEnglish = getEnglishType(query);
  if (typeInEnglish) {
    await showPokemonsByType(typeInEnglish);
    return;
  }

  // Si es un Pokémon
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${query}`);
    if (!res.ok) throw new Error("Pokémon no encontrado");
    const data = await res.json();

    const name = data.name;
    const id = data.id;
    const img = data.sprites.other["official-artwork"].front_default;
    const shiny = data.sprites.other["official-artwork"].front_shiny;
    const types = data.types.map(t => t.type.name);

    // 🟦 Obtenemos hasta 10 movimientos con sus tipos, potencia y precisión
    const movePromises = data.moves.slice(0, 10).map(async m => {
      try {
        const moveRes = await fetch(m.move.url);
        const moveData = await moveRes.json();
        const moveName = capitalize(moveData.name.replace("-", " "));
        const moveType = moveData.type.name;
        const power = moveData.power ? moveData.power : "—";
        const accuracy = moveData.accuracy ? `${moveData.accuracy}%` : "—";
        return `${moveName} (${typeTranslations[moveType] || capitalize(moveType)}) – Potencia: ${power}, Precisión: ${accuracy}`;
      } catch {
        return capitalize(m.move.name.replace("-", " "));
      }
    });

    const moves = await Promise.all(movePromises);

    pokemonInfo.innerHTML = `
      <div style="display:flex;justify-content:center;gap:20px;align-items:center;flex-wrap:wrap;">
        <div>
          <img src="${img}" alt="${name}" style="width:220px;">
          <p style="text-align:center;font-weight:bold;">Normal</p>
        </div>
        <div>
          <img src="${shiny}" alt="${name} shiny" style="width:220px;">
          <p style="text-align:center;font-weight:bold;color:#fbc531;">Shiny ✨</p>
        </div>
      </div>

      <h2 style="text-transform:capitalize;">${name}</h2>
      <p>#${id}</p>
      <p>Tipo: ${types.map(t => typeTranslations[t] || t).join(", ")}</p>
      
      <h3>Movimientos principales</h3>
      <ul style="columns:2;list-style:disc;margin-left:20px;">
        ${moves.map(m => `<li>${m}</li>`).join("")}
      </ul>

      <div id="evolutions"><p>Cargando evolución...</p></div>
      <p style="font-size:12px;">Datos obtenidos desde <a href="https://pokeapi.co" target="_blank">PokeAPI</a>.</p>
    `;

    highlightTypeMatchups(types);
    await showEvolutionInfo(id);
  } catch {
    pokemonInfo.innerHTML = `<p style="color:red;">No se encontró el Pokémon 😢</p>`;
    clearHighlights();
  }
});

// 🧹 Botón limpiar
clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  pokemonInfo.innerHTML = "";
  clearHighlights();
});

// ⚔️ Colores en la tabla
async function highlightTypeMatchups(types) {
  clearHighlights();
  let damageRelations = {
    double_damage_from: [],
    half_damage_from: [],
    no_damage_from: [],
  };

  for (const type of types) {
    const res = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
    const data = await res.json();
    damageRelations.double_damage_from.push(...data.damage_relations.double_damage_from.map(t => t.name));
    damageRelations.half_damage_from.push(...data.damage_relations.half_damage_from.map(t => t.name));
    damageRelations.no_damage_from.push(...data.damage_relations.no_damage_from.map(t => t.name));
  }

  const weak = new Set(damageRelations.double_damage_from);
  const resist = new Set(damageRelations.half_damage_from);
  const immune = new Set(damageRelations.no_damage_from);

  typeCells.forEach(cell => {
    const t = cell.dataset.type;
    if (immune.has(t)) cell.classList.add("immune");
    else if (weak.has(t)) cell.classList.add("weak");
    else if (resist.has(t)) cell.classList.add("resist");
  });
}

function clearHighlights() {
  typeCells.forEach(cell => cell.classList.remove("weak", "resist", "immune"));
}

// 🌱 Mostrar evolución
async function showEvolutionInfo(pokemonId) {
  try {
    const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`);
    const speciesData = await speciesRes.json();

    const evoRes = await fetch(speciesData.evolution_chain.url);
    const evoData = await evoRes.json();

    const evolutionHTML = buildEvolutionChain(evoData.chain);
    document.getElementById("evolutions").innerHTML = `<h3>Evolución</h3>${evolutionHTML}`;
  } catch {
    document.getElementById("evolutions").innerHTML = `<p>No se pudo obtener la evolución 😢</p>`;
  }
}

function buildEvolutionChain(chain) {
  let html = "";
  const first = chain.species.name;

  if (chain.evolves_to.length === 0) {
    html += `<p>${capitalize(first)} no tiene evoluciones.</p>`;
    return html;
  }

  html += `<ul>`;
  for (const evo1 of chain.evolves_to) {
    const evo1Name = evo1.species.name;
    const level1 = evo1.evolution_details[0]?.min_level || "???";
    html += `<li>${capitalize(first)} ➜ ${capitalize(evo1Name)} (Nivel ${level1})</li>`;

    for (const evo2 of evo1.evolves_to) {
      const evo2Name = evo2.species.name;
      const level2 = evo2.evolution_details[0]?.min_level || "???";
      html += `<li>${capitalize(evo1Name)} ➜ ${capitalize(evo2Name)} (Nivel ${level2})</li>`;
    }
  }
  html += `</ul>`;
  return html;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 🆕 Buscar Pokémon por tipo (con imágenes)
async function showPokemonsByType(type) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/type/${type}`);
    if (!res.ok) throw new Error("Tipo no encontrado");
    const data = await res.json();

    // Limitamos a los primeros 40 para no sobrecargar la página
    const pokemons = data.pokemon.slice(0, 40);

    pokemonInfo.innerHTML = `
      <h2>Pokémon de tipo ${typeTranslations[type] || capitalize(type)}</h2>
      <div id="pokemon-list" style="display:flex;flex-wrap:wrap;gap:15px;justify-content:center;">
        <p>Cargando Pokémon...</p>
      </div>
      <p style="font-size:12px;">Mostrando los primeros ${pokemons.length} Pokémon</p>
    `;

    const listContainer = document.getElementById("pokemon-list");
    listContainer.innerHTML = ""; // Limpiar el "Cargando"

    // 🔹 Cargar cada Pokémon con su imagen oficial
    for (const p of pokemons) {
      const name = p.pokemon.name;
      try {
        const pokeRes = await fetch(p.pokemon.url);
        const pokeData = await pokeRes.json();
        const img = pokeData.sprites.other["official-artwork"].front_default;

        listContainer.innerHTML += `
          <div style="width:120px;text-align:center;">
            <img src="${img}" alt="${name}" style="width:100px;height:100px;object-fit:contain;">
            <p>${capitalize(name)}</p>
          </div>
        `;
      } catch {
        // Si falla una imagen, muestra solo el nombre
        listContainer.innerHTML += `<div style="width:120px;text-align:center;"><p>${capitalize(name)}</p></div>`;
      }
    }

    clearHighlights();
    document.querySelector(`[data-type='${type}']`)?.classList.add("highlight");
  } catch {
    pokemonInfo.innerHTML = `<p style="color:red;">No se encontró el tipo 😢</p>`;
  }
}

// 🔄 Traducción español → inglés para tipos
function getEnglishType(type) {
  const lower = type.toLowerCase();
  // Si ya está en inglés
  if (typeTranslations[lower]) return lower;
  // Buscar por valor en español
  for (const [en, es] of Object.entries(typeTranslations)) {
    if (es.toLowerCase() === lower) return en;
  }
  return null;
}
