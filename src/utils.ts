/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Inspection, ModuleType, InspectionCharacteristics, DeliveryControl, ModuleControl } from "./types";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getSanitaireImagePath } from "./components/SanitaireReferenceImage";

/**
 * Calculates recommended repairs / works based on selected options and module type.
 */
export function calculateAutomaticTravaux(
  type: ModuleType,
  chars: InspectionCharacteristics
): string {
  const list: string[] = [];

  // Keys rules
  // "Si 2 clefs sont présentes lorsque nous le demandons, rien ne se passe. Si 1 clef est présente, noter "double des clefs" dans travaux à prévoir. Si 0 clef présente, noter "Barillet" dans travaux à prévoir."
  const hasKeyField =
    type === "B6" ||
    type === "B5" ||
    type === "B4" ||
    type === "SD2" ||
    type === "SDU" ||
    type === "SSU" ||
    type === "Sanitaire 6m";

  if (hasKeyField && chars.cles !== undefined) {
    if (chars.cles === 1) {
      list.push("- Double des clefs à prévoir");
    } else if (chars.cles === 0) {
      list.push("- Remplacement du barillet de serrure à prévoir");
    }
  }

  // Cuves rules
  if ((type === "Cuve 2500L" || type === "Cuve 6300L") && chars.vidangee === false) {
    list.push("- Vidange de la cuve obligatoire (cuve pleine)");
  }

  // Container clef-canne rules
  if (type === "C20'" && chars.clefCanne === false) {
    list.push("- Fournir une clef-canne manquante");
  }

  return list.join("\n");
}

/**
 * Generates an elegant PDF document from an inspection report and triggers a direct download.
 */
export async function generateInspectionPDF(
  inspection: Inspection,
  onProgress?: (msg: string) => void
): Promise<boolean> {
  try {
    onProgress?.("Préparation de la mise en page...");

    // Create an elegant print-only DOM container off-screen
    const printContainer = document.createElement("div");
    printContainer.style.position = "absolute";
    printContainer.style.left = "-9999px";
    printContainer.style.top = "-9999px";
    printContainer.style.width = "790px"; // A4 Standard responsive width in pixels
    printContainer.style.backgroundColor = "#ffffff";
    printContainer.style.padding = "20px";
    printContainer.style.fontFamily = "'Inter', system-ui, sans-serif";
    printContainer.style.color = "#1e293b";

    // Formatted date string
    const formattedDate = new Date(inspection.date).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Subcontract characteristics info HTML
    let charsHtml = "";
    const c = inspection.characteristics;

    if (
      inspection.moduleType === "B6" ||
      inspection.moduleType === "B5" ||
      inspection.moduleType === "B4"
    ) {
      let climTrappeText = "Non configuré";
      if (c.climTrappe === "Clim") {
        const sizeStr = c.climTaille === "autre" ? (c.climTailleAutre || "Autre") : (c.climTaille || "");
        climTrappeText = `Climatiseur (${sizeStr})`;
      } else if (c.climTrappe === "Trappe") {
        climTrappeText = `Trappe (${c.trappeTaille || ""})`;
      }

      let sanitaireText = "Aucun";
      const sanParts: string[] = [];
      if (c.wcCount && c.wcCount > 0) {
        sanParts.push(`${c.wcCount} WC`);
      }
      if (c.doucheCount && c.doucheCount > 0) {
        sanParts.push(`${c.doucheCount} Douche(s)`);
      } else if (c.presenceDouche) {
        sanParts.push(`Douche`);
      }
      if (sanParts.length > 0) {
        sanitaireText = sanParts.join(" / ");
      }

      let eclairageText = "N/A";
      if (c.eclairageType && c.eclairageType !== "none") {
        const typeLabel = c.eclairageType === "neons" ? "Néons" : "Dalles LED";
        const controlLabel = c.commandeEclairage === "interrupteur" 
          ? "Interrupteur" 
          : c.commandeEclairage === "detecteur" 
            ? "Détecteur de présence" 
            : "";
        eclairageText = `${typeLabel}${controlLabel ? ` avec ${controlLabel}` : ""}`;
      }

      charsHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; line-height: 1.6;">
          <tr>
            <td style="padding: 4px 8px; width: 50%;"><strong>Gamme :</strong> ${c.gamme || "N/A"}</td>
            <td style="padding: 4px 8px; width: 50%;"><strong>Implantation :</strong> ${c.configurationType || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px;"><strong>Confort thermique :</strong> ${climTrappeText}</td>
            <td style="padding: 4px 8px;"><strong>Éclairage :</strong> ${eclairageText}</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px;"><strong>Cuisine :</strong> ${
              c.cuisineType && c.cuisineType !== "none"
                ? `Cuisine ${c.cuisineType === "Bois" ? "Bois" : "Métal"} (${c.cuisine120 ? "120cm" : "80cm"})`
                : "Aucune"
            }</td>
            <td style="padding: 4px 8px;"><strong>Équipement Sanitaire :</strong> ${sanitaireText}</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px;"><strong>Clés présentes :</strong> ${c.cles ?? 0}</td>
            <td style="padding: 4px 8px;"><strong>Couleur extérieure :</strong> ${
              c.couleurRAL || "Standard / Non choisie"
            }</td>
          </tr>
        </table>
      `;
    } else if (inspection.moduleType === "S1" || inspection.moduleType === "SS1") {
      charsHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; line-height: 1.6;">
          <tr>
            <td style="padding: 4px 8px; width: 50%;"><strong>Chauffe-eau :</strong> ${
              c.chauffeEau ? "Présence Chauffe-eau (Oui)" : "Non"
            }</td>
            <td style="padding: 4px 8px; width: 50%;"><strong>Type WC :</strong> ${c.typeWC || "Aucun"}</td>
          </tr>
        </table>
      `;
    } else if (inspection.moduleType === "SD1") {
      charsHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; line-height: 1.6;">
          <tr>
            <td style="padding: 4px 8px;"><strong>Type WC :</strong> ${c.typeWC || "Aucun"}</td>
          </tr>
        </table>
      `;
    } else if (
      inspection.moduleType === "SD2" ||
      inspection.moduleType === "SDU" ||
      inspection.moduleType === "SSU"
    ) {
      charsHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; line-height: 1.6;">
          <tr>
            <td style="padding: 4px 8px;"><strong>Clés présentes :</strong> ${c.cles ?? 0}</td>
          </tr>
        </table>
      `;
    } else if (inspection.moduleType === "Sanitaire 6m") {
      charsHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; line-height: 1.6;">
          <tr>
            <td style="padding: 4px 8px; width: 50%;"><strong>Configuration :</strong> ${
              c.configSanitaire || "N/A"
            }</td>
            <td style="padding: 4px 8px; width: 50%;"><strong>Communication Vestiaires :</strong> ${
              c.commVestiaire ? "Prévu (Oui)" : "Non"
            }</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px;" colspan="2"><strong>Clés présentes :</strong> ${c.cles ?? 0}</td>
          </tr>
        </table>
      `;
    } else if (inspection.moduleType === "C20'") {
      charsHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; line-height: 1.6;">
          <tr>
            <td style="padding: 4px 8px; width: 50%;"><strong>Couleur :</strong> ${
              c.couleurContainer || "N/A"
            }</td>
            <td style="padding: 4px 8px; width: 50%;"><strong>Clef-Canne :</strong> ${
              c.clefCanne ? "Oui" : "Non"
            }</td>
          </tr>
        </table>
      `;
    } else if (
      inspection.moduleType === "C8'" ||
      inspection.moduleType === "C10'" ||
      inspection.moduleType === "C20' OS"
    ) {
      charsHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; line-height: 1.6;">
          <tr>
            <td style="padding: 4px 8px;"><strong>Couleur :</strong> ${
              c.couleurContainer || "N/A"
            }</td>
          </tr>
        </table>
      `;
    } else if (
      inspection.moduleType === "Cuve 2500L" ||
      inspection.moduleType === "Cuve 6300L"
    ) {
      charsHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; line-height: 1.6;">
          <tr>
            <td style="padding: 4px 8px;"><strong>État de vidange :</strong> ${
              c.vidangee ? "Vidangée (Vide)" : "Non vidangée (Pleine)"
            }</td>
          </tr>
        </table>
      `;
    } else {
      charsHtml = `<div style="color: #64748b; font-style: italic; padding: 4px 8px; font-size: 11px;">Aucune caractéristique optionnelle spécifique disponible pour ce type de matériel.</div>`;
    }

    // Mobilier quantities table if present
    let furnitureHtml = "";
    if (
      c.mobilier &&
      Object.values(c.mobilier).some((qty) => qty > 0) &&
      ["B6", "B5", "B4"].includes(inspection.moduleType)
    ) {
      furnitureHtml = `
        <div style="margin-top: 20px; margin-bottom: 25px; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; page-break-inside: avoid;">
          <div style="background-color: #333333; color: white; padding: 10px 16px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
            📋 EXPLOITATION - TABLEAU DE MOBILIER RÉPERTORIÉ
          </div>
          <div style="padding: 10px 16px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569;">
                  <th style="text-align: left; padding: 6px 12px; font-weight: bold;">Meuble / Équipement de chantier</th>
                  <th style="text-align: center; padding: 6px 12px; width: 120px; font-weight: bold;">Quantité relevée</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(c.mobilier)
                  .filter(([_, qty]) => qty > 0)
                  .map(
                    ([name, qty]) => `
                  <tr style="border-bottom: 1px dashed #f1f5f9;">
                    <td style="padding: 6px 12px; text-transform: capitalize; color: #334155; font-weight: 500;">
                      ${name === "microondes" ? "Micro-ondes" : name === "frigo" ? "Réfrigérateur" : name === "caisson" ? "Caisson roulant" : name}
                    </td>
                    <td style="padding: 6px 12px; text-align: center; font-weight: bold; color: #1e293b;">${qty}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    const sketchImgTag = inspection.sketchDataUrl
      ? `<img src="${inspection.sketchDataUrl}" style="width: 100%; max-height: 380px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 8px;" />`
      : `<div style="border: 2px dashed #cbd5e1; height: 180px; display: flex; align-items: center; justify-content: center; color: #94a3b8; border-radius: 8px; font-size: 11px; font-weight: 500;">Aucun croquis manuel dessiné</div>`;

    let sanitaryImgHtml = "";
    if (["S1", "SD1", "SS1", "SD2", "SDU", "SSU", "Sanitaire 6m"].includes(inspection.moduleType)) {
      const configSanitaire = inspection.characteristics.configSanitaire;
      const targetType = inspection.moduleType === "Sanitaire 6m"
        ? (configSanitaire === "DX" ? "SANITAIRE_6M_DX" : "SANITAIRE_6M_SX")
        : inspection.moduleType;
      const imagePath = getSanitaireImagePath(targetType);
      const label = inspection.moduleType === "Sanitaire 6m"
        ? `Sanitaire 6m — ${configSanitaire || "SX"}`
        : inspection.moduleType;

      if (imagePath) {
        sanitaryImgHtml = `
          <div style="margin-bottom: 25px; page-break-inside: avoid; border: 1.5px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #333333; color: white; padding: 10px 16px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
              📐 PLAN TECHNIQUE DE LA CABINE SANITAIRE (FAC-SIMILÉ USINE)
            </div>
            <div style="padding: 16px; text-align: center; background-color: #ffffff;">
              <img src="${imagePath}" style="width: 100%; max-height: 320px; object-fit: contain; border-radius: 6px;" />
              <div style="font-size: 9px; font-family: monospace; color: #D96C0F; text-align: center; margin-top: 8px; font-weight: bold;">
                Plan certifié de référence : ${label}.jpg
              </div>
            </div>
          </div>
        `;
      } else {
        sanitaryImgHtml = `
          <div style="margin-bottom: 25px; page-break-inside: avoid; border: 1.5px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #333333; color: white; padding: 10px 16px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
              📐 PLAN TECHNIQUE SANITAIRE
            </div>
            <div style="border: 1px dashed #cbd5e1; background-color: #f8fafc; padding: 24px; text-align: center; color: #64748b; font-size: 11px;">
              Image de référence non disponible pour ce type.
            </div>
          </div>
        `;
      }
    } else {
      sanitaryImgHtml = `
        <div style="margin-bottom: 25px; page-break-inside: avoid; border: 1.5px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #333333; color: white; padding: 10px 16px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">
            ✏️ CROQUIS TECHNIQUE & MARQUAGES DE DOMMAGES
          </div>
          <div style="padding: 16px; text-align: center; background-color: #ffffff;">
            ${sketchImgTag}
          </div>
        </div>
      `;
    }

    let photosHtml = "";
    if (inspection.photos && inspection.photos.length > 0) {
      photosHtml = `
        <div style="margin-top: 15px; margin-bottom: 15px;">
          <div style="background-color: #333333; color: white; padding: 12px 18px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 8px 8px 0 0; display: flex; align-items: center; gap: 6px;">
            📷 PHOTOGRAPHIES DU CONSTAT (CHANTIER)
          </div>
          <div style="border: 1.5px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; padding: 16px; background-color: #ffffff;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
        `;
        inspection.photos.forEach((src, idx) => {
          if (idx > 0 && idx % 2 === 0) {
            photosHtml += `</tr><tr>`;
          }
          photosHtml += `
            <td style="width: 50%; padding: 8px; text-align: center; vertical-align: top;">
              <div style="border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 8px; background-color: #f8fafc; display: block; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <img src="${src}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0;" />
                <div style="font-size: 10px; color: #1e293b; font-weight: bold; margin-top: 6px;">
                  Photo #${idx + 1} du constat
                </div>
                <div style="font-size: 8.5px; color: #64748b; font-weight: 500; font-family: monospace; margin-top: 2px;">
                  Prise le ${new Date(inspection.date).toLocaleDateString("fr-FR")}
                </div>
              </div>
            </td>
          `;
        });
        if (inspection.photos.length % 2 !== 0) {
          photosHtml += `<td style="width: 50%; padding: 8px;"></td>`;
        }
        photosHtml += `
              </tr>
            </table>
          </div>
        </div>
      `;
    }

    // Dynamic Conformity Banner (🟢 Conforme etc.) - Removed per user request ("A retirer 'Résultat du constat de conformité'")
    const conformityBannerHtml = "";

    // Signatures blocks HTML - proposed ONLY for "Sur chantier"
    let signaturesHtml = "";
    if (inspection.nature === "constat") {
      const techSigned = !!inspection.signatureTechnicien;
      const clientSigned = !!inspection.signatureClient;

      signaturesHtml = `
        <div style="margin-top: 30px; page-break-inside: avoid; border-top: 2px solid #e2e8f0; padding-top: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; background-color: #f8fafc; min-height: 160px; display: flex; flex-col; justify-content: space-between;">
                  <div>
                    <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">👤 LE TECHNICIEN BUNG'ECO</div>
                    <div style="font-size: 12px; font-weight: 800; color: #1e293b; margin-top: 4px;">${inspection.nomTechnicien || "Non renseigné"}</div>
                  </div>
                  <div style="text-align: center; margin-top: 10px;">
                    ${techSigned ? `
                      <div style="font-size: 8.5px; color: #059669; font-weight: bold; margin-bottom: 4px;">✓ SIGNATURE ÉLECTRONIQUE VALIDÉE</div>
                      <img src="${inspection.signatureTechnicien}" style="max-height: 80px; max-width: 100%; object-fit: contain; background: #ffffff; border: 1px dashed #cbd5e1; padding: 4px; border-radius: 4px;" />
                    ` : `
                      <div style="border: 1.5px dashed #cbd5e1; border-radius: 6px; padding: 16px 8px; color: #94a3b8; font-size: 10px; font-style: italic; font-weight: 600; background: #ffffff;">
                        Document non signé par le technicien
                      </div>
                    `}
                  </div>
                </div>
              </td>
              <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; background-color: #f8fafc; min-height: 160px; display: flex; flex-col; justify-content: space-between;">
                  <div>
                    <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">🤝 REPRÉSENTANT CLIENT / CHANTIER</div>
                    <div style="font-size: 12px; font-weight: 800; color: #1e293b; margin-top: 4px;">${inspection.nomClient || "Non renseigné"}</div>
                  </div>
                  <div style="text-align: center; margin-top: 10px;">
                    ${clientSigned ? `
                      <div style="font-size: 8.5px; color: #059669; font-weight: bold; margin-bottom: 4px;">✓ SIGNATURE ÉLECTRONIQUE VALIDÉE</div>
                      <img src="${inspection.signatureClient}" style="max-height: 80px; max-width: 100%; object-fit: contain; background: #ffffff; border: 1px dashed #cbd5e1; padding: 4px; border-radius: 4px;" />
                    ` : `
                      <div style="border: 1.5px dashed #cbd5e1; border-radius: 6px; padding: 16px 8px; color: #94a3b8; font-size: 10px; font-style: italic; font-weight: 600; background: #ffffff;">
                        Document non signé par le client
                      </div>
                    `}
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </div>
      `;
    }

    printContainer.innerHTML = `
      <!-- 1. HEADER LOGO BUNG'ECO & REPORT TITLE -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; border-bottom: 3.5px solid #D96C0F; padding-bottom: 12px;">
        <tr>
          <td style="vertical-align: middle;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background-color: #D96C0F; color: #ffffff; border-radius: 8px; padding: 5px 12px; font-weight: 950; font-size: 18px; font-family: sans-serif; display: inline-block;">B</span>
              <div>
                <span style="font-size: 24px; font-weight: 950; color: #1e293b; letter-spacing: 0.05em;">BUNG'ECO</span>
                <span style="font-size: 21px; font-weight: 400; color: #D96C0F; margin-left: 2px;">• EDL</span>
              </div>
            </div>
            <div style="font-size: 8.5px; color: #64748b; margin-top: 4px; font-weight: 850; letter-spacing: 0.04em;">
              SOLUTIONS DE MODULES MONOBLOCS ET BUNGALOWS PROFESSIONNELS
            </div>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <div style="background-color: #f1f5f9; color: #334155; display: inline-block; padding: 6px 14px; font-weight: 800; font-size: 10.5px; border-radius: 6px; letter-spacing: 0.03em; border: 1px solid #cbd5e1;">
              CONSTAT D'ÉTAT DES LIEUX DE CHANTIER
            </div>
            <div style="font-size: 8px; color: #64748b; margin-top: 3px; font-family: monospace;">Fiche réglementaire certifiée</div>
          </td>
        </tr>
      </table>

      <!-- 2. HIGH VISIBILITY MODULE CARTRIDGE (La référence du module) -->
      <div style="background-color: #333333; color: #ffffff; text-align: center; padding: 18px 24px; border-radius: 12px; margin-bottom: 22px; font-family: sans-serif; box-shadow: 0 4px 10px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; gap: 10px;">
        <span style="font-size: 24px; font-weight: 900; letter-spacing: 0.05em;">🔖 MODULE N° ${inspection.moduleNumber}</span>
      </div>

      <!-- 3. SYNTHESIS BLOCK -->
      <div style="display: grid; grid-template-columns: repeat(${inspection.nature === "constat" ? 4 : 3}, 1fr); gap: 12px; margin-bottom: 22px;">
        <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px; text-align: center;">
          <div style="font-size: 14px; margin-bottom: 2px;">📦</div>
          <div style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 800;">Type</div>
          <div style="font-size: 12px; font-weight: 850; color: #1e293b; margin-top: 1px;">BUNG'ECO ${inspection.moduleType}</div>
        </div>
        <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px; text-align: center;">
          <div style="font-size: 14px; margin-bottom: 2px;">📅</div>
          <div style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 800;">Date du constat</div>
          <div style="font-size: 12px; font-weight: 850; color: #1e293b; margin-top: 1px;">${formattedDate}</div>
        </div>
        <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px; text-align: center;">
          <div style="font-size: 14px; margin-bottom: 2px;">🚚</div>
          <div style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 800;">Ope. Nature</div>
          <div style="font-size: 12px; font-weight: 850; color: #1e293b; margin-top: 1px; text-transform: uppercase;">
            ${inspection.nature === "reprise" ? "🔄 Fin de location" : inspection.nature === "constat" ? "👷 Sur chantier" : "📦 Avant livraison"}
          </div>
        </div>
        ${inspection.nature === "constat" ? `
        <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px; text-align: center; overflow: hidden;">
          <div style="font-size: 14px; margin-bottom: 2px;">📍</div>
          <div style="font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 800;">Chantier</div>
          <div style="font-size: 11px; font-weight: 850; color: #1e293b; margin-top: 1px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${inspection.chantier || "Non spécifié"}">
            ${inspection.chantier || "Non spécifié"}
          </div>
        </div>
        ` : ""}
      </div>

      <!-- 5. TECHNICAL SPECIFICATIONS & DETAILS -->
      <div style="margin-bottom: 22px; border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; page-break-inside: avoid; background-color: #ffffff;">
        <div style="background-color: #333333; color: white; padding: 10px 16px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px;">
          ⚙️ SPÉCIFICATIONS TECHNIQUES DU CONTAINER CONSTATÉ
        </div>
        <div style="padding: 12px; background-color: #ffffff;">
          ${charsHtml}
        </div>
      </div>

      <!-- 6. FURNITURE (IF AVAILABLE) -->
      ${furnitureHtml}

      <!-- 7. AUTOMATIC CHECKS AND DEFECTS BOX -->
      <div style="margin-bottom: 22px; border: 1.5px solid #f59e0b; border-radius: 12px; overflow: hidden; page-break-inside: avoid; background-color: #ffffff;">
        <div style="background-color: #fffbeb; padding: 10px 16px; border-bottom: 1.5px solid #f59e0b; display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 12px;">⚠️</span>
          <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #b45309; margin: 0; font-weight: 800; font-family: sans-serif;">
            TRAVAUX ET PIÈCES DE RECHANGE À PRÉVOIR
          </h3>
        </div>
        <div style="padding: 14px; background-color: #ffffff; font-size: 11px; line-height: 1.6; white-space: pre-wrap; font-family: monospace; color: #b45309; font-weight: bold;">${
          inspection.travauxPrevoir.trim() ||
          "Aucun dommage ou remise en état requis. Matériel livré 100% conforme aux chartes d'habitabilité BUNG'ECO."
        }</div>
      </div>

      <!-- 8. TECHNICAL TEXT COMMENTS -->
      <div style="margin-bottom: 22px; page-break-inside: avoid;">
        <div style="font-size: 11px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; border-bottom: 2.5px solid #D96C0F; padding-bottom: 4px; font-family: sans-serif; display: flex; align-items: center; gap: 6px;">
          📝 OBSERVATIONS DU TECHNICIEN (DÉTAILS COMPLÉMENTAIRES)
        </div>
        <div style="padding: 14px; background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 11px; line-height: 1.65; min-height: 55px; color: #334155;">
          ${inspection.observations.trim() ? inspection.observations.replace(/\n/g, "<br/>") : "Aucune observation particulière consignée sur ce document d'inspection."}
        </div>
      </div>

      <!-- 9. DRAWINGS, SKETCHES & PLANS -->
      ${sanitaryImgHtml}

      <!-- 10. PHOTO COLLAGE GRID -->
      ${photosHtml}

      <!-- 11. SIGNATURES AND SIGNATORIES WORKFLOW  -->
      ${signaturesHtml}

      <!-- FOOTER STATEMENTS -->
      <div style="text-align: center; font-size: 8px; color: #64748b; margin-top: 40px; font-family: monospace; font-weight: bold; border-t: 1px solid #cbd5e1; padding-top: 15px;">
        Rapport d'inspection numérique BUNG'ECO généré au format officiel A4 le ${new Date().toLocaleString(
          "fr-FR"
        )} — BUNG'ECO S.A.S. Tous droits réservés.
      </div>
    `;

    document.body.appendChild(printContainer);

    onProgress?.("Génération de l'image haute définition...");
    const canvas = await html2canvas(printContainer, {
      scale: 2, // Retinal high density
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    onProgress?.("Création du document PDF final...");
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Scale to fit exactly on ONE single page (A4 format)
    // We compute both scale factors and take the minimum to fit both dimensions nicely
    const scale = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const finalWidth = imgWidth * scale;
    const finalHeight = imgHeight * scale;

    const xOffset = (pdfWidth - finalWidth) / 2;
    const yOffset = (pdfHeight - finalHeight) / 2;

    pdf.addImage(imgData, "JPEG", xOffset, yOffset, finalWidth, finalHeight);

    onProgress?.("Lancement du téléchargement...");
    let fileFormattedDate = inspection.date || ""; 
    if (fileFormattedDate.includes("-")) {
      const parts = fileFormattedDate.split("-");
      if (parts.length === 3 && parts[0].length === 4) {
        // AAAA-MM-JJ to JJ_MM_AAAA_
        fileFormattedDate = `${parts[2]}_${parts[1]}_${parts[0]}_`;
      } else {
        fileFormattedDate = fileFormattedDate.replace(/-/g, "_") + "_";
      }
    } else if (fileFormattedDate.includes("/")) {
      fileFormattedDate = fileFormattedDate.replace(/\//g, "_") + "_";
    } else {
      fileFormattedDate = fileFormattedDate + "_";
    }

    pdf.save(`EDL-${inspection.moduleNumber}-${fileFormattedDate}.pdf`);

    // Remove print element
    document.body.removeChild(printContainer);
    return true;
  } catch (err) {
    console.error("Failed to generate PDF:", err);
    return false;
  }
}

const MODULE_QUESTIONS = [
  { id: "q1_labels", text: "Toutes les étiquettes sont présentes ?" },
  { id: "q2_keys", text: "Les 2 clés sont sur le barillet ?" },
  { id: "q3_lifting", text: "Les 4 plaques de levage sont présentes ?" },
  { id: "q4_screws", text: "Toutes les vis sont présentes ?" },
  { id: "q5_joints", text: "Les joints intérieurs sont corrects ?" },
  { id: "q6_closed", text: "Les fenêtres sont fermées et les portes verrouillées ?" },
  { id: "q7_plugged", text: "Les trous sont bouchés ?" },
  { id: "q8_parecloses", text: "Les parecloses sont-elles toutes présentes sur les menuiseries ?" },
  { id: "q9_transport", text: "Le module peut être transporté sans problème ?" },
  { id: "q10_profiles", text: "Tous les profils d'assemblage sont présents ?" },
  { id: "q11_protection", text: "Filet de protection mis en place ?" },
  { id: "q12_general", text: "État général du module satisfaisant ?" },
] as const;

const ORDER_QUESTIONS = [
  { id: "qc1_serial_match", text: "Les numéros correspondent à ceux de la fiche atelier ?" },
  { id: "qc2_plan_match", text: "Les modules sont conformes au plan ?" },
  { id: "qc3_variants_present", text: "Les variantes prévues sont présentes ? (clim, cuisinette, etc.)" },
  { id: "qc4_furniture_qty", text: "Le quantitatif du mobilier est respecté ?" },
  { id: "qc5_atelier_match", text: "Le module est conforme à la fiche atelier ?" },
] as const;

/**
 * Generates an elegant Delivery Control PDF with multi-module sections, results and photos.
 */
export async function generateDeliveryControlPDF(
  control: DeliveryControl,
  onProgress?: (msg: string) => void
): Promise<boolean> {
  try {
    onProgress?.("Préparation du rapport de contrôle...");

    const printContainer = document.createElement("div");
    printContainer.style.position = "absolute";
    printContainer.style.left = "-9999px";
    printContainer.style.top = "-9999px";
    printContainer.style.width = "790px"; // A4 Standard responsive width
    printContainer.style.backgroundColor = "#ffffff";
    printContainer.style.padding = "25px";
    printContainer.style.fontFamily = "'Inter', system-ui, sans-serif";
    printContainer.style.color = "#1e293b";

    const formattedDate = new Date(control.date).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const questionLabels: Record<string, string> = {
      q1_labels: "Toutes les étiquettes sont présentes ?",
      q2_keys: "Les 2 clés sont sur le barillet ?",
      q3_lifting: "Les 4 plaques de levage sont présentes ?",
      q4_screws: "Toutes les vis sont présentes ?",
      q5_joints: "Les joints intérieurs sont corrects ?",
      q6_closed: "Les fenêtres sont fermées et les portes verrouillées ?",
      q7_plugged: "Les trous sont bouchés ?",
      q8_parecloses: "Les parecloses sont-elles toutes présentes sur les menuiseries ?",
      q9_transport: "Le module peut être transporté sans problème ?",
      q10_profiles: "Tous les profils d'assemblage sont présents ?",
      q11_protection: "Filet de protection mis en place ?",
      q12_general: "État général du module satisfaisant ?",
      qc1_serial_match: "Les numéros correspondent à ceux de la fiche atelier ?",
      qc2_plan_match: "Les modules sont conformes au plan ?",
      qc3_variants_present: "Les variantes prévues sont présentes ? (clim, cuisinette, etc.)",
      qc4_furniture_qty: "Le quantitatif du mobilier est respecté ?",
      qc5_atelier_match: "Le module est conforme à la fiche atelier ?",
    };

    const formatAnswer = (ans: string) => {
      if (ans === "conforme") return `<span style="color: #10b981; font-weight: bold;">✔ CONFORME</span>`;
      if (ans === "non_conforme") return `<span style="color: #ea580c; font-weight: bold;">✖ NON CONFORME</span>`;
      return `<span style="color: #64748b; font-weight: 500;">Ø SANS OBJET</span>`;
    };

    // --- PAGE 1: GLOBAL CONTROL SUMMARY ---
    let htmlContent = `
      <!-- HEADER HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #d96c0f; padding-bottom: 20px; margin-bottom: 25px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background-color: #d96c0f; color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; box-shadow: 0 4px 6px -1px rgba(217,108,15,0.2);">
            B
          </div>
          <div style="text-align: left;">
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.1em; color: #1e293b; text-transform: uppercase;">BUNG'ECO</div>
            <div style="font-size: 9px; font-weight: bold; color: #d96c0f; letter-spacing: 0.05em; text-transform: uppercase;">CONTRÔLE DES MODULES AVANT EXPÉDITION</div>
          </div>
        </div>
        <div style="text-align: right; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 8px;">
          <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">STATUT DE COMMANDE</div>
          <div style="font-size: 13px; font-weight: 900; color: #1e293b; margin-top: 2px;">
            ${control.status === "termine" ? "✅ SYNTHÈSE TERMINÉE" : "⏸ EN ATTENTE"}
          </div>
        </div>
      </div>

      <!-- MAIN TITLE BOX -->
      <div style="background-color: #1e293b; border-radius: 12px; padding: 22px; color: white; text-align: left; margin-bottom: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <span style="font-size: 10px; font-weight: 900; background-color: #d96c0f; color: white; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase;">
          Fiche de Suivi Qualité
        </span>
        <h1 style="font-size: 20px; font-weight: 900; margin: 10px 0 2px 0; letter-spacing: -0.02em; text-transform: uppercase;">
          📦 CONTRÔLE AVANT LIVRAISON
        </h1>
        <p style="font-size: 11px; color: #94a3b8; font-weight: 500; margin: 0;">
          Rapport complet de conformité globale de la commande client avant départ de l'atelier.
        </p>
      </div>

      <!-- GENERAL DETAILS GRID -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 30px; text-align: left;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #d96c0f; text-transform: uppercase; tracking-wider: 0.05em; margin-bottom: 4px;">👤 Client destinataire</div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${control.client}</div>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #d96c0f; text-transform: uppercase; tracking-wider: 0.05em; margin-bottom: 4px;">📅 Date du contrôle</div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${formattedDate}</div>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #d96c0f; text-transform: uppercase; tracking-wider: 0.05em; margin-bottom: 4px;">🕵️ Contrôleur</div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${control.controller}</div>
        </div>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #d96c0f; text-transform: uppercase; tracking-wider: 0.05em; margin-bottom: 4px;">📝 Réf Commande</div>
          <div style="font-size: 13px; font-weight: 805; color: #0f172a; font-family: monospace;">${control.cmdRef || "Non renseignée"}</div>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #d96c0f; text-transform: uppercase; tracking-wider: 0.05em; margin-bottom: 4px;">📍 Destination</div>
          <div style="font-size: 13px; font-weight: 805; color: #0f172a;">${control.chantier || "Non renseignée"}</div>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 10px;">
          <div style="font-size: 9px; font-weight: 800; color: #d96c0f; text-transform: uppercase; tracking-wider: 0.05em; margin-bottom: 4px;">📦 Volumes contrôlés</div>
          <div style="font-size: 13px; font-weight: 805; color: #0f172a;">${control.modules.length} module(s)</div>
        </div>
      </div>

      <!-- TABLE SUMMARY OF CONTROLLED MODULES -->
      <div style="text-align: left; margin-bottom: 40px;">
        <div style="background-color: #1e293b; color: white; padding: 12px 18px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 8px 8px 0 0;">
          🧾 INVENTAIRE ET SYNTHÈSE DES MODULES DE LA COMMANDE
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #cbd5e1; border-top: none;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 10px 15px; text-align: left; font-weight: 800; color: #334155; width: 33%;">Référence Module</th>
              <th style="padding: 10px 15px; text-align: left; font-weight: 800; color: #334155; width: 33%;">Type de Module</th>
              <th style="padding: 10px 15px; text-align: center; font-weight: 800; color: #334155; width: 34%;">Verdict Qualité</th>
            </tr>
          </thead>
          <tbody>
            ${control.modules.map((m) => `
              <tr style="border-bottom: 1px solid #cbd5e1;">
                <td style="padding: 12px 15px; font-weight: 950; font-family: monospace; color: #0f172a;">${m.moduleNumber}</td>
                <td style="padding: 12px 15px; font-weight: bold; color: #334155;">BUNG'ECO ${m.moduleType}</td>
                <td style="padding: 12px 15px; text-align: center;">
                  ${
                    m.status === "conforme" 
                      ? `<span style="background-color: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 9999px; font-size: 9px; font-weight: bold; border: 1px solid #a7f3d0;">🟢 MODULE CONFORME</span>`
                      : `<span style="background-color: #ffedd5; color: #9a3412; padding: 4px 10px; border-radius: 9999px; font-size: 9px; font-weight: bold; border: 1px solid #fed7aa;">🟠 AVEC RÉSERVES</span>`
                  }
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <!-- FOOTER FIRST PAGE -->
      <div style="text-align: center; font-size: 8px; color: #64748b; margin-top: 80px; font-family: monospace; font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 15px;">
        Page 1 • Synthèse Générale • EDL Manager Pro — BUNG'ECO S.A.S.
      </div>
    `;

    // --- DETAILED PAGE FOR EACH MODULE ---
    control.modules.forEach((m, mIdx) => {
      // Build Checklist HTML
      const mChecklistHtml = MODULE_QUESTIONS.map((q) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 12px; text-align: left; width: 75%; color: #344155; font-weight: 500;">${q.text}</td>
          <td style="padding: 6px 12px; text-align: right; width: 25%; font-size: 9.5px; font-family: monospace;">${formatAnswer(m[q.id])}</td>
        </tr>
      `).join("");

      const oChecklistHtml = ORDER_QUESTIONS.map((q) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 12px; text-align: left; width: 75%; color: #344155; font-weight: 500;">${q.text}</td>
          <td style="padding: 6px 12px; text-align: right; width: 25%; font-size: 9.5px; font-family: monospace;">${formatAnswer(m[q.id])}</td>
        </tr>
      `).join("");

      // Photos section inside detailed page
      let photosHtml = "";
      if (m.photos && m.photos.length > 0) {
        photosHtml = `
          <div style="margin-top: 15px;">
            <div style="background-color: #475569; color: white; padding: 8px 12px; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 6px 6px 0 0; text-align: left;">
              📷 CLICHÉS DU CONTRÔLE (MODULE ${m.moduleNumber})
            </div>
            <div style="padding: 10px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 6px 6px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-start; background-color: #f8fafc;">
              ${m.photos.map((ph) => `
                <img src="${ph}" style="width: 215px; height: 140px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; background: #ffffff;" />
              `).join("")}
            </div>
          </div>
        `;
      }

      htmlContent += `
        <div style="page-break-before: always; text-align: left; margin-top: 10px;">
          
          <!-- HEADING OF SPECIFIC MODULE -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 15px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="font-size: 20px;">📦</div>
              <div>
                <h2 style="font-size: 15px; font-weight: 900; color: #1e293b; margin: 0; text-transform: uppercase;">
                  RAPPORT MODULE ${m.moduleNumber}
                </h2>
                <div style="font-size: 9px; color: #64748b; font-weight: bold; font-family: monospace;">
                  INDEX COMMANDES : ${mIdx + 1} SUR ${control.modules.length} • TYPE : BUNG'ECO ${m.moduleType}
                </div>
              </div>
            </div>

            <!-- RESULT BANNER -->
            <div>
              ${
                m.status === "conforme"
                  ? `<div style="background-color: #d1fae5; color: #065f46; font-size: 9.5px; font-weight: 900; padding: 6px 12px; border-radius: 6px; border: 1.5px solid #10b981;">🟢 MODULE CONFORME</div>`
                  : `<div style="background-color: #ffedd5; color: #9a3412; font-size: 9.5px; font-weight: 900; padding: 6px 12px; border-radius: 6px; border: 1.5px solid #ea580c;">🟠 MODULE AVEC RÉSERVES</div>`
              }
            </div>
          </div>

          <!-- CHECKLISTS GRID -->
          <div style="display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 15px;">
            
            <!-- TABLE 1: MODULE CONFORMITY -->
            <div>
              <div style="background-color: #334155; color: white; padding: 6px 12px; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 6px 6px 0 0;">
                I. EXAMEN DU MODULE EN ATELIER 
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #e2e8f0; border-top: none;">
                <tbody>
                  ${mChecklistHtml}
                </tbody>
              </table>
            </div>

            <!-- TABLE 2: ORDER CONFORMITY -->
            <div style="margin-top: 5px;">
              <div style="background-color: #475569; color: white; padding: 6px 12px; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 6px 6px 0 0;">
                II. CONFORMITÉ AU CAHIER DES CHARGES / COMMANDE
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #e2e8f0; border-top: none;">
                <tbody>
                  ${oChecklistHtml}
                </tbody>
              </table>
            </div>

          </div>

          <!-- REMARKS AND PARTICULIÈRES SECTION -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
              <div style="font-size: 8.5px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">📌 Références particulières</div>
              <div style="font-size: 9.5px; color: #0f172a; font-weight: bold; min-height: 25px; font-family: sans-serif;">
                ${m.refParticulieres ? m.refParticulieres.replace(/\n/g, "<br />") : "Aucune référencée"}
              </div>
            </div>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
              <div style="font-size: 8.5px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">📝 Observations du contrôleur</div>
              <div style="font-size: 9.5px; color: #0f172a; font-weight: bold; min-height: 25px; font-family: sans-serif;">
                ${m.observations ? m.observations.replace(/\n/g, "<br />") : "Aucune observation rédigée"}
              </div>
            </div>
          </div>

          <!-- PHOTOS SECTION IF ANY -->
          ${photosHtml}

          <!-- FOOTER DETAIL PAGE -->
          <div style="text-align: center; font-size: 8px; color: #64748b; margin-top: 30px; font-family: monospace; font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 15px;">
            Rapport Module ${m.moduleNumber} • Commande ${control.client} • Page ${mIdx + 2} — BUNG'ECO EDL Manager Pro
          </div>
        </div>
      `;
    });

    printContainer.innerHTML = htmlContent;
    document.body.appendChild(printContainer);

    onProgress?.("Prise des clichés du rapport de contrôle...");
    const canvas = await html2canvas(printContainer, {
      scale: 2, // High resolution retina rendering
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    onProgress?.("Génération des pages PDF de la livraison...");
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // A single vertical continuous visual capture sliced onto nice A4 formats automatically
    // or as we set standard pixel size, A4 vertical page size is pdfHeight
    const scale = pdfWidth / imgWidth;
    const scaledImgHeight = imgHeight * scale;

    let currentY = 0;
    let pageCount = 0;
    while (currentY < scaledImgHeight) {
      if (pageCount > 0) {
        pdf.addPage();
      }
      
      pdf.addImage(imgData, "JPEG", 0, -currentY, pdfWidth, scaledImgHeight);
      currentY += pdfHeight;
      pageCount++;
    }

    onProgress?.("Sauvegarde du rapport final...");
    let fileFormattedDate = control.date || "";
    fileFormattedDate = fileFormattedDate.replace(/-/g, "_");
    
    pdf.save(`CONTROL-LIVRAISON-${control.client.replace(/\s+/g, "_")}-${fileFormattedDate}.pdf`);

    // Remove print element
    document.body.removeChild(printContainer);
    return true;
  } catch (err) {
    console.error("Failed to generate Delivery Control PDF:", err);
    return false;
  }
}

