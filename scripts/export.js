import fs from "fs";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const serviceAccountAuth = new JWT({
  email: process.env.GSERVICE_EMAIL,
  key: process.env.GSERVICE_KEY.replace(/\\n/g, "\n"),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GSHEET_ID, serviceAccountAuth);

async function run() {
  await doc.loadInfo();

  /* ---------- 1. RÉCUPÉRATION DES ONGLETS ---------- */
  const playlistsSheet = doc.sheetsByTitle["Playlists"];
  const playlistsRows = await playlistsSheet.getRows();

  const episodesSheet = doc.sheetsByTitle["Episodes"];
  const episodesRows = await episodesSheet.getRows();

  /* ---------- 2. TRAITEMENT DES ÉPISODES (Version Allégée) ---------- */
  const episodes = episodesRows.map(r => ({
    episodeId: r.get("EpisodeID"),
    playlistId: r.get("PlaylistID"),
    title: r.get("Title"),
    audio: r.get("AudioURL") || "",
    order: Number(r.get("Order")) || 0,
    guid: r.get("Guid"),
    // On ne met PLUS la description ici pour gagner du poids
    image: r.get("Image") || ""
  })).filter(ep => ep.playlistId); // Sécurité : ignore les lignes vides

  /* ---------- 3. TRAITEMENT DES PLAYLISTS (Avec description piochée) ---------- */
  const playlists = playlistsRows.map(r => {
    const pId = String(r.get("PlaylistID")).trim();

    // On cherche le premier épisode de cette playlist pour voler sa description
    const firstEpMatch = episodesRows.find(epRow => String(epRow.get("PlaylistID")).trim() === pId);
    const descriptionFromEpisode = firstEpMatch ? firstEpMatch.get("Description") : "";

    return {
      id: pId,
      name: r.get("TitreAffichage"),
      description: descriptionFromEpisode || r.get("Description") || "", // Priorité à la description de l'épisode
      public: r.get("Public") === "TRUE" || r.get("Public") === true,
      season: r.get("Saison") || "Saison inconnue",
      image: r.get("Image") || (firstEpMatch ? firstEpMatch.get("Image") : ""),
      hashtags: r.get("Hashtag") || "" // AJOUT ICI : Récupère le contenu de la colonne "Hashtag"
    };
  }).filter(pl => pl.id); // Sécurité : ignore les lignes sans ID

  /* ---------- 4. ÉCRITURE ET NETTOYAGE ---------- */
  if (!fs.existsSync("data")) fs.mkdirSync("data", { recursive: true });
  
  // Écriture de playlists.json (Contient maintenant les descriptions de la col G)
  fs.writeFileSync("data/playlists.json", JSON.stringify(playlists, null, 2));
  
  // Écriture de episodes.json (Fichier ultra-léger sans les textes longs)
  fs.writeFileSync("data/episodes.json", JSON.stringify(episodes, null, 2));
  
  console.log("--------------------------------------------------");
  console.log("✅ Exportation terminée avec succès !");
  console.log(`📊 Playlists traitées : ${playlists.length}`);
  console.log(`🎵 Épisodes traités : ${episodes.length}`);
  console.log("📝 Les descriptions ont été centralisées dans playlists.json");
  console.log("--------------------------------------------------");
}

run().catch(err => {
  console.error("❌ Erreur lors de l'exportation :", err);
  process.exit(1);
});
