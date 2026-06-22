/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  ModuleType,
  InspectionCharacteristics,
  Inspection,
  INITIAL_MOBILIER,
} from "../types";
import { calculateAutomaticTravaux } from "../utils";
import IdentificationSection from "./IdentificationSection";
import CharacteristicsSection from "./CharacteristicsSection";
import SanitaireSection from "./SanitaireSection";
import SketchSection from "./SketchSection";
import PhotoSection from "./PhotoSection";
import ObservationsSection from "./ObservationsSection";
import ActionsBar from "./ActionsBar";
import SignaturesSection from "./SignaturesSection";
import { AlertOctagon } from "lucide-react";

interface EDLFormProps {
  initialInspection?: Inspection | null;
  onSave: (inspection: Omit<Inspection, "id" | "createdAt" | "sketchDataUrl" | "photos"> & {
    id?: string;
    sketchDataUrl?: string;
    photos?: string[];
    status?: "conforme" | "reserves" | "non_conforme";
    nature?: "livraison" | "reprise" | "constat";
    chantier?: string;
    nomTechnicien?: string;
    nomClient?: string;
    signatureTechnicien?: string;
    signatureClient?: string;
  }) => void;
  onCancel?: () => void;
  isSaving?: boolean;
  onModuleNumberChange?: (num: string) => void;
  onModuleTypeChange?: (type: ModuleType) => void;
}

export default function EDLForm({
  initialInspection,
  onSave,
  onCancel,
  isSaving = false,
  onModuleNumberChange,
  onModuleTypeChange,
}: EDLFormProps) {
  // 1. Module Type
  const [moduleType, setModuleType] = useState<ModuleType>("B6");
  // 2. Module Number
  const [moduleNumber, setModuleNumber] = useState("");
  // 3. Date
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Synthesis and conformity states
  const [status, setStatus] = useState<"conforme" | "reserves" | "non_conforme">("conforme");
  const [nature, setNature] = useState<"livraison" | "reprise" | "constat">("reprise");
  const [chantier, setChantier] = useState("");

  // Signatures and names states
  const [nomTechnicien, setNomTechnicien] = useState("");
  const [nomClient, setNomClient] = useState("");
  const [signatureTechnicien, setSignatureTechnicien] = useState("");
  const [signatureClient, setSignatureClient] = useState("");

  // Clean up signatures and chantier if nature of operation is not "constat" (Sur chantier)
  useEffect(() => {
    if (nature !== "constat") {
      setSignatureTechnicien("");
      setSignatureClient("");
      setChantier("");
    }
  }, [nature]);

  // Keep parent state updated with current values in real-time
  useEffect(() => {
    if (onModuleNumberChange) {
      onModuleNumberChange(moduleNumber);
    }
  }, [moduleNumber, onModuleNumberChange]);

  useEffect(() => {
    if (onModuleTypeChange) {
      onModuleTypeChange(moduleType);
    }
  }, [moduleType, onModuleTypeChange]);

  // 4. Characteristics according to type
  const [characteristics, setCharacteristics] = useState<InspectionCharacteristics>({
    gamme: "Flex",
    eclairageType: "neons",
    commandeEclairage: "interrupteur",
    configurationType: "none",
    climTrappe: "none",
    cuisineType: "none",
    cuisine120: false,
    sanitaireType: "none",
    wcCount: 0,
    presenceDouche: false,
    mobilier: { ...INITIAL_MOBILIER },
    cles: 2,
    couleurRAL: "RAL 7016",
    chauffeEau: false,
    typeWC: "none",
    configSanitaire: "SX",
    commVestiaire: false,
    clefCanne: true,
    couleurContainer: "RAL 9010",
    vidangee: true,
  });

  // Sketch data
  const [sketchDataUrl, setSketchDataUrl] = useState<string>("");

  // Photos array
  const [photos, setPhotos] = useState<string[]>([]);

  // 6. Travaux à prévoir (Automatic with hand-overwrite state)
  const [travauxPrevoir, setTravauxPrevoir] = useState("");
  const [isAutoSyncTravaux, setIsAutoSyncTravaux] = useState(true);

  // 8. Observations
  const [observations, setObservations] = useState("");

  const [activeSubTab, setActiveSubTab] = useState<"structure" | "fluides" | "furniture">("structure");

  const [formError, setFormError] = useState<string | null>(null);

  // Load existing inspection if in edit mode, or reset if creating a new one
  useEffect(() => {
    if (initialInspection) {
      setModuleType(initialInspection.moduleType);
      setModuleNumber(initialInspection.moduleNumber);
      setDate(initialInspection.date);
      setCharacteristics(initialInspection.characteristics);
      setSketchDataUrl(initialInspection.sketchDataUrl || "");
      setTravauxPrevoir(initialInspection.travauxPrevoir);
      setIsAutoSyncTravaux(false); // Disable auto-sync so manual overrides are loaded
      setObservations(initialInspection.observations);
      setPhotos(initialInspection.photos || []);
      
      // Load new fields
      setStatus(initialInspection.status || "conforme");
      setNature(initialInspection.nature || "reprise");
      setChantier(initialInspection.chantier || "");
      setNomTechnicien(initialInspection.nomTechnicien || "");
      setNomClient(initialInspection.nomClient || "");
      setSignatureTechnicien(initialInspection.signatureTechnicien || "");
      setSignatureClient(initialInspection.signatureClient || "");
    } else {
      setModuleType("B6");
      setModuleNumber("");
      setDate(new Date().toISOString().split("T")[0]);
      setCharacteristics({
        gamme: "Flex",
        eclairageType: "neons",
        commandeEclairage: "interrupteur",
        configurationType: "none",
        climTrappe: "none",
        cuisineType: "none",
        cuisine120: false,
        sanitaireType: "none",
        wcCount: 0,
        presenceDouche: false,
        mobilier: { ...INITIAL_MOBILIER },
        cles: 2,
        couleurRAL: "RAL 7016",
        chauffeEau: false,
        typeWC: "none",
        configSanitaire: "SX",
        commVestiaire: false,
        clefCanne: true,
        couleurContainer: "RAL 9010",
        vidangee: true,
      });
      setSketchDataUrl("");
      setTravauxPrevoir("");
      setIsAutoSyncTravaux(true);
      setObservations("");
      setPhotos([]);
      
      // Reset new fields
      setStatus("conforme");
      setNature("reprise");
      setChantier("");
      setNomTechnicien("");
      setNomClient("");
      setSignatureTechnicien("");
      setSignatureClient("");
    }
  }, [initialInspection]);

  // Handle auto-sync works
  useEffect(() => {
    if (isAutoSyncTravaux) {
      const autoTasks = calculateAutomaticTravaux(moduleType, characteristics);
      setTravauxPrevoir(autoTasks);
    }
  }, [moduleType, characteristics, isAutoSyncTravaux]);

  const handleResetCharacteristics = (type: ModuleType) => {
    // Return sensible defaults based on type
    const base: InspectionCharacteristics = {
      cles: 2,
      mobilier: { ...INITIAL_MOBILIER },
    };

    if (type === "B6") {
      base.gamme = "Flex";
      base.eclairageType = "neons";
      base.commandeEclairage = "interrupteur";
      base.configurationType = "none";
      base.climTrappe = "none";
      base.cuisineType = "none";
      base.cuisine120 = false;
      base.sanitaireType = "none";
      base.wcCount = 0;
      base.presenceDouche = false;
      base.couleurRAL = "RAL 7016";
    } else if (type === "B5" || type === "B4") {
      base.configurationType = "none";
      base.climTrappe = "none";
      base.cuisineType = "none";
      base.cuisine120 = false;
      base.sanitaireType = "none";
      base.wcCount = 0;
      base.presenceDouche = false;
      base.couleurRAL = "RAL 7016";
    } else if (type === "S1" || type === "SS1") {
      base.chauffeEau = true;
      base.typeWC = "WC anglais";
    } else if (type === "SD1") {
      base.typeWC = "WC anglais";
    } else if (type === "Sanitaire 6m") {
      base.configSanitaire = "SX";
      base.commVestiaire = false;
    } else if (type === "C20'") {
      base.couleurContainer = "RAL 9010";
      base.clefCanne = true;
    } else if (type === "C8'" || type === "C10'" || type === "C20' OS") {
      base.couleurContainer = "RAL 9010";
    } else if (type === "Cuve 2500L" || type === "Cuve 6300L") {
      base.vidangee = true;
    }

    setCharacteristics(base);
    setIsAutoSyncTravaux(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleNumber.trim()) {
      setFormError("Veuillez renseigner la référence du module avant de générer l’EDL.");
      return;
    }
    if (!date) {
      setFormError("Veuillez indiquer la date du constat.");
      return;
    }
    setFormError(null);

    onSave({
      id: initialInspection?.id,
      moduleType,
      moduleNumber: moduleNumber.trim().toUpperCase(),
      date,
      characteristics,
      sketchDataUrl: ["S1", "SD1", "SS1", "SD2", "SDU", "SSU", "Sanitaire 6m"].includes(moduleType)
        ? ""
        : sketchDataUrl,
      travauxPrevoir,
      observations,
      photos,
      status,
      nature,
      chantier,
      nomTechnicien,
      nomClient,
      signatureTechnicien,
      signatureClient,
    });
  };

  const isSanitaire = ["S1", "SD1", "SS1", "SD2", "SDU", "SSU", "Sanitaire 6m"].includes(moduleType);

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4 select-none">
      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs flex items-start gap-1.5 shrink-0 animate-fade-in font-semibold">
          <AlertOctagon size={14} className="shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-2 text-left">
        
        {/* Left Side: Parameters, Identity, Specifications */}
        <div className="space-y-4">
          {/* Section 1: Identity */}
          <IdentificationSection
            moduleType={moduleType}
            setModuleType={setModuleType}
            moduleNumber={moduleNumber}
            setModuleNumber={setModuleNumber}
            date={date}
            setDate={setDate}
            handleResetCharacteristics={handleResetCharacteristics}
            setActiveSubTab={(tab) => setActiveSubTab(tab as any)}
            status={status}
            setStatus={setStatus}
            nature={nature}
            setNature={setNature}
            chantier={chantier}
            setChantier={setChantier}
          />

          {/* Section 2: Technical specifications & furniture */}
          <CharacteristicsSection
            moduleType={moduleType}
            characteristics={characteristics}
            setCharacteristics={setCharacteristics}
          />
        </div>

        {/* Right Side: Visual sketch, reference plan, photos & comments */}
        <div className="space-y-4">
          {/* Section 3: Drawing Croquis or Sanitary reference image */}
          {isSanitaire ? (
            <SanitaireSection
              moduleType={moduleType}
              configSanitaire={characteristics.configSanitaire}
            />
          ) : (
            <SketchSection
              moduleType={moduleType}
              characteristics={characteristics}
              setSketchDataUrl={setSketchDataUrl}
            />
          )}

          {/* Section 4: Manual calculations or notes */}
          <ObservationsSection
            travauxPrevoir={travauxPrevoir}
            setTravauxPrevoir={setTravauxPrevoir}
            isAutoSyncTravaux={isAutoSyncTravaux}
            setIsAutoSyncTravaux={setIsAutoSyncTravaux}
            observations={observations}
            setObservations={setObservations}
          />

          {/* Section 5: Photograph Manager */}
          <PhotoSection
            photos={photos}
            setPhotos={setPhotos}
            readOnly={false}
          />

          {/* Section 6: Signatures Pad */}
          {nature === "constat" && (
            <SignaturesSection
              nomTechnicien={nomTechnicien}
              setNomTechnicien={setNomTechnicien}
              nomClient={nomClient}
              setNomClient={setNomClient}
              signatureTechnicien={signatureTechnicien}
              setSignatureTechnicien={setSignatureTechnicien}
              signatureClient={signatureClient}
              setSignatureClient={setSignatureClient}
            />
          )}

          {/* Section 7: Action buttons and live validations */}
          <ActionsBar
            moduleNumber={moduleNumber}
            date={date}
            travauxPrevoir={travauxPrevoir}
            photos={photos}
            observations={observations}
            moduleType={moduleType}
            onCancel={onCancel}
            isSaving={isSaving}
          />
        </div>

      </div>
    </form>
  );
}
