import { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Linking
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import { colors, shadows, radius } from "../../constants/theme";
import AriaLogo from "../../components/AriaLogo";

const GUIDE_COLOR = "#0F4C81";

const INTRO = {
  doctor: {
    fr: "ARIA vous accompagne dans le suivi de vos patients et l'analyse de leurs radiographies grâce à l'intelligence artificielle. Voici comment tirer le meilleur parti de votre espace, étape par étape.",
    en: "ARIA helps you track your patients and analyze their X-rays with artificial intelligence. Here's how to make the most of your workspace, step by step."
  },
  radiologist: {
    fr: "ARIA vous permet de gérer vos propres patients et leurs analyses, tout en traitant les consultations que des médecins ou l'administrateur vous soumettent pour validation. Voici comment tirer le meilleur parti de votre espace, étape par étape.",
    en: "ARIA lets you manage your own patients and their analyses, while also processing consultations submitted to you by doctors or the admin for review. Here's how to make the most of your workspace, step by step."
  },
  admin: {
    fr: "ARIA vous donne une vue d'ensemble et un contrôle total sur la plateforme : comptes, modèles d'intelligence artificielle et activité globale. Voici comment tirer le meilleur parti de votre espace, étape par étape.",
    en: "ARIA gives you a full overview and control over the platform: accounts, AI models, and overall activity. Here's how to make the most of your workspace, step by step."
  }
};

const SECTIONS = {
  doctor: {
    fr: [
      { icon: "🔐", title: "Se connecter à votre compte", text: "Ouvrez l'application et saisissez votre adresse email et votre mot de passe. Si c'est votre première utilisation, créez un compte via \"Créer un compte\", puis ouvrez votre boîte mail (en pensant à vérifier le dossier Spams) pour cliquer sur le lien d'activation reçu. Ce lien reste valable 24 heures ; si vous tentez de vous connecter après ce délai, un nouveau lien vous est envoyé automatiquement." },
      { icon: "📊", title: "Votre tableau de bord", text: "Après connexion, vous arrivez sur le Dashboard. Il résume votre activité en un coup d'œil : nombre de patients suivis, nombre d'analyses réalisées, et vos actions récentes. C'est votre point de départ avant de naviguer vers les autres sections via le menu en bas de l'écran." },
      { icon: "👥", title: "Ajouter un nouveau patient", text: "Ouvrez l'onglet Patients, puis appuyez sur le bouton d'ajout. Renseignez le prénom, le nom, la date de naissance et le sexe du patient. Le numéro de dossier médical (MRN) est attribué automatiquement par le système : vous n'avez rien à choisir, ce champ s'affiche en lecture seule. Validez pour créer le dossier." },
      { icon: "📂", title: "Consulter un dossier patient", text: "Dans la liste des patients, appuyez sur une fiche pour ouvrir son dossier complet : informations personnelles, historique des images envoyées et résultats des analyses passées." },
      { icon: "🗑️", title: "Supprimer un patient", text: "Pour supprimer un patient, glissez sa fiche vers la gauche dans la liste et appuyez sur \"Supprimer\". Le système efface automatiquement et en cascade toutes les radiographies, analyses et rapports liés à ce patient : vous n'avez aucune étape préalable à effectuer. Cette action est définitive et ne peut pas être annulée, alors assurez-vous de votre choix avant de confirmer." },
      { icon: "📤", title: "Étape 1 : envoyer une radiographie", text: "Ouvrez le dossier du patient concerné, puis appuyez sur \"Ajouter une image\". Sélectionnez une photo existante dans votre galerie ou prenez directement la radiographie en photo avec l'appareil de votre téléphone. Choisissez ensuite le type d'examen : Thorax (poumons, cœur) ou Os/Articulation, afin que le bon modèle d'intelligence artificielle soit utilisé pour l'analyse." },
      { icon: "🤖", title: "Étape 2 : lancer l'analyse IA", text: "Une fois l'image envoyée, l'analyse démarre automatiquement, sans action supplémentaire de votre part. Selon le type choisi, ARIA utilise le modèle DenseNet-121 (détection de 14 pathologies thoraciques) ou EfficientNetV2-S (détection Normal/Anormal pour les os). Le traitement prend généralement quelques secondes." },
      { icon: "🔬", title: "Étape 3 : lire et comprendre les résultats", text: "Les résultats s'affichent sous forme de liste, classés du pourcentage de probabilité le plus élevé au plus faible pour chaque pathologie détectée. Une carte de chaleur (heatmap), superposée à l'image originale, met en évidence les zones précises qui ont influencé la décision de l'intelligence artificielle. Ces résultats sont fournis à titre indicatif et ne remplacent en aucun cas l'avis d'un professionnel de santé qualifié." },
      { icon: "🩺", title: "Étape 4 : demander un second avis (optionnel)", text: "Si vous le souhaitez, appuyez sur \"Envoyer au radiologue\" depuis l'écran de résultats pour soumettre le cas à un radiologue disponible. Ajoutez un message décrivant le contexte clinique si cela peut l'aider dans son examen. Une discussion s'ouvre alors automatiquement entre vous deux." },
      { icon: "💬", title: "Suivre une consultation", text: "Rendez-vous dans l'onglet Chat pour suivre l'état de votre consultation (ouverte ou fermée) et échanger des messages avec le radiologue en temps réel." },
      { icon: "✅", title: "Recevoir la validation ou le rejet", text: "Si le radiologue valide l'analyse, son feedback clinique s'ajoute directement au dossier et un rapport mis à jour est généré automatiquement. S'il la rejette, le motif précis vous est transmis à la fois par message dans le chat et par email : il vous suffit alors de corriger le point soulevé et de soumettre une nouvelle analyse." },
      { icon: "📄", title: "Télécharger le rapport PDF", text: "Depuis l'écran de résultats, appuyez sur \"Télécharger le rapport PDF\" pour obtenir un document complet réunissant les résultats de l'IA, la heatmap et, le cas échéant, l'avis du radiologue. Vous pouvez l'enregistrer sur votre téléphone ou le partager directement par message ou email." },
      { icon: "💳", title: "Passer en Premium", text: "Le compte gratuit permet un nombre limité d'analyses chaque mois. Depuis votre Profil, appuyez sur l'offre Premium pour vous abonner via K-Pay et débloquer des analyses illimitées, la génération de rapports PDF et un chat illimité avec les radiologues." },
      { icon: "👤", title: "Personnaliser votre profil", text: "Dans l'onglet Profil, modifiez vos informations personnelles, activez le mode sombre, changez la langue de l'application et consultez l'état de votre abonnement à tout moment." },
    ],
    en: [
      { icon: "🔐", title: "Signing in", text: "Open the app and enter your email and password. If this is your first time, create an account via \"Create account\", then open your inbox (checking the Spam folder too) and tap the activation link you received. This link stays valid for 24 hours; if you try to log in after that, a new link is sent to you automatically." },
      { icon: "📊", title: "Your dashboard", text: "After logging in, you land on the Dashboard. It summarizes your activity at a glance: number of patients tracked, analyses performed, and your recent actions. This is your starting point before navigating to other sections via the bottom menu." },
      { icon: "👥", title: "Adding a new patient", text: "Open the Patients tab and tap the add button. Enter the patient's first name, last name, date of birth, and gender. The medical record number (MRN) is assigned automatically by the system: there's nothing to choose, this field is shown read-only. Confirm to create the record." },
      { icon: "📂", title: "Viewing a patient record", text: "In the patient list, tap a card to open the full record: personal information, history of submitted images, and past analysis results." },
      { icon: "🗑️", title: "Deleting a patient", text: "To delete a patient, swipe their card left in the list and tap \"Delete\". The system automatically cascades the deletion to every X-ray, analysis, and report linked to that patient: there's no preliminary step required from you. This action is permanent and cannot be undone, so make sure before confirming." },
      { icon: "📤", title: "Step 1: Submitting an X-ray", text: "Open the patient's record and tap \"Add image\". Pick an existing photo from your gallery or take the X-ray photo directly with your phone's camera. Then choose the exam type: Chest (lungs, heart) or Bone/Joint, so the correct AI model is used for the analysis." },
      { icon: "🤖", title: "Step 2: Running the AI analysis", text: "Once the image is uploaded, analysis starts automatically, with no further action needed from you. Depending on the chosen type, ARIA uses either DenseNet-121 (detecting 14 chest pathologies) or EfficientNetV2-S (Normal/Abnormal detection for bones). Processing usually takes a few seconds." },
      { icon: "🔬", title: "Step 3: Reading and understanding the results", text: "Results appear as a list, ranked from the highest to the lowest probability percentage for each detected pathology. A heatmap, overlaid on the original image, highlights the exact areas that influenced the AI's decision. These results are provided for guidance only and never replace a qualified healthcare professional's opinion." },
      { icon: "🩺", title: "Step 4: Requesting a second opinion (optional)", text: "If you wish, tap \"Send to radiologist\" from the results screen to submit the case to an available radiologist. Add a message describing the clinical context if it could help their review. A discussion automatically opens between you two." },
      { icon: "💬", title: "Tracking a consultation", text: "Go to the Chat tab to follow your consultation's status (open or closed) and exchange real-time messages with the radiologist." },
      { icon: "✅", title: "Getting validation or rejection", text: "If the radiologist validates the analysis, their clinical feedback is added directly to the record and an updated report is generated automatically. If they reject it, the exact reason is sent to you both via a chat message and email: simply fix the issue raised and submit a new analysis." },
      { icon: "📄", title: "Downloading the PDF report", text: "From the results screen, tap \"Download PDF report\" to get a complete document combining AI results, the heatmap, and, if available, the radiologist's opinion. You can save it to your phone or share it directly by message or email." },
      { icon: "💳", title: "Going Premium", text: "The free account allows a limited number of analyses each month. From your Profile, tap the Premium offer to subscribe via K-Pay and unlock unlimited analyses, PDF report generation, and unlimited chat with radiologists." },
      { icon: "👤", title: "Personalizing your profile", text: "In the Profile tab, edit your personal information, enable dark mode, change the app's language, and check your subscription status at any time." },
    ]
  },
  radiologist: {
    fr: [
      { icon: "🔐", title: "Se connecter à votre compte", text: "Connectez-vous avec l'email et le mot de passe fournis par l'administrateur lors de la création de votre compte. Si votre email n'est pas encore vérifié, un lien d'activation vous est envoyé automatiquement lors de votre première tentative de connexion." },
      { icon: "📊", title: "Votre tableau de bord", text: "Le Dashboard résume votre activité en un coup d'œil : nombre de vos propres patients suivis, analyses réalisées, et consultations traitées." },
      { icon: "👥", title: "Gérer vos propres patients", text: "L'onglet Patients vous permet de créer, consulter et gérer vos propres dossiers patients, exactement comme un médecin. Vous ne voyez que les patients que vous avez créés vous-même : les dossiers créés par d'autres médecins, radiologues ou l'administrateur ne sont pas visibles depuis votre compte." },
      { icon: "🗑️", title: "Supprimer un de vos patients", text: "Glissez la fiche du patient vers la gauche dans la liste et appuyez sur \"Supprimer\". Le système efface automatiquement toutes les radiographies, analyses et rapports liés, sans étape préalable nécessaire. Cette action est définitive." },
      { icon: "📤", title: "Soumettre une radiographie sur vos patients", text: "Depuis le dossier d'un de vos patients, ajoutez une image radiographique (thorax ou os) comme le ferait un médecin. Choisissez le type d'examen correspondant pour que le bon modèle d'IA soit appliqué." },
      { icon: "🤖", title: "Lancer l'analyse IA", text: "L'analyse démarre automatiquement après l'envoi de l'image. ARIA utilise DenseNet-121 pour le thorax ou EfficientNetV2-S pour les os, selon le type choisi. Le traitement prend quelques secondes." },
      { icon: "🔬", title: "Lire les résultats", text: "Consultez les pathologies détectées avec leur probabilité, ainsi que la carte de chaleur (heatmap) qui montre les zones analysées par l'IA. Pour vos propres patients, vous êtes le seul validateur : il n'y a pas de second avis à demander puisque c'est votre rôle." },
      { icon: "📄", title: "Générer un rapport PDF", text: "Téléchargez le rapport PDF complet de l'analyse depuis l'écran de résultats, pour le sauvegarder ou le partager." },
      { icon: "💬", title: "Traiter les consultations reçues", text: "L'onglet Consultations liste les analyses soumises par les médecins ou l'administrateur pour validation. Filtrez par statut \"Ouvertes\" ou \"Fermées\". Vous n'avez accès qu'aux dossiers patients qui vous sont directement envoyés via ces consultations." },
      { icon: "🔍", title: "Examiner une consultation", text: "Ouvrez une consultation pour voir l'image radiographique, les résultats de l'IA et le message initial du médecin ou de l'administrateur décrivant le contexte clinique." },
      { icon: "✅", title: "Valider une consultation", text: "Appuyez sur \"Valider\" pour confirmer l'analyse. Ajoutez un feedback clinique optionnel qui enrichira le rapport final. La personne à l'origine de la demande reçoit automatiquement une notification et un email de confirmation." },
      { icon: "❌", title: "Rejeter une consultation", text: "Si l'analyse nécessite une correction, appuyez sur \"Rejeter\" et indiquez un motif clair d'au moins 5 caractères. Ce motif est envoyé automatiquement par message dans le chat et par email à la personne concernée, avec une demande de nouvelle soumission." },
      { icon: "💬", title: "Échanger pendant une consultation", text: "Envoyez des messages texte pour demander des précisions à la personne ayant soumis le cas, avant de valider ou rejeter." },
      { icon: "👤", title: "Personnaliser votre profil", text: "Dans l'onglet Profil, modifiez vos informations personnelles, activez le mode sombre et changez la langue de l'application." },
    ],
    en: [
      { icon: "🔐", title: "Signing in", text: "Sign in with the email and password provided by the admin when your account was created. If your email isn't verified yet, an activation link is sent to you automatically on your first login attempt." },
      { icon: "📊", title: "Your dashboard", text: "The Dashboard summarizes your activity at a glance: number of your own patients tracked, analyses performed, and consultations processed." },
      { icon: "👥", title: "Managing your own patients", text: "The Patients tab lets you create, view, and manage your own patient records, exactly like a doctor. You only see patients you created yourself: records created by other doctors, radiologists, or the admin are not visible from your account." },
      { icon: "🗑️", title: "Deleting one of your patients", text: "Swipe the patient's card left in the list and tap \"Delete\". The system automatically erases every linked X-ray, analysis, and report, with no preliminary step needed. This action is permanent." },
      { icon: "📤", title: "Submitting an X-ray for your patients", text: "From one of your patients' records, add an X-ray image (chest or bone) just like a doctor would. Choose the matching exam type so the correct AI model is applied." },
      { icon: "🤖", title: "Running the AI analysis", text: "Analysis starts automatically once the image is uploaded. ARIA uses DenseNet-121 for chest or EfficientNetV2-S for bones, depending on the chosen type. Processing takes a few seconds." },
      { icon: "🔬", title: "Reading the results", text: "Review the detected pathologies with their probability, along with the heatmap showing the areas analyzed by the AI. For your own patients, you are the sole reviewer: there's no second opinion to request since that's precisely your role." },
      { icon: "📄", title: "Generating a PDF report", text: "Download the full PDF report of the analysis from the results screen, to save or share it." },
      { icon: "💬", title: "Processing received consultations", text: "The Consultations tab lists analyses submitted by doctors or the admin for review. Filter by \"Open\" or \"Closed\" status. You only have access to patient records directly sent to you through these consultations." },
      { icon: "🔍", title: "Reviewing a consultation", text: "Open a consultation to view the X-ray image, the AI results, and the initial message from the doctor or admin describing the clinical context." },
      { icon: "✅", title: "Validating a consultation", text: "Tap \"Validate\" to confirm the analysis. Add optional clinical feedback that will enrich the final report. The person who submitted the request automatically receives a notification and confirmation email." },
      { icon: "❌", title: "Rejecting a consultation", text: "If the analysis needs correction, tap \"Reject\" and provide a clear reason of at least 5 characters. This reason is automatically sent via a chat message and email to the person involved, requesting a new submission." },
      { icon: "💬", title: "Communicating during a consultation", text: "Send text messages to ask the requester for clarification before validating or rejecting." },
      { icon: "👤", title: "Personalizing your profile", text: "In the Profile tab, edit your personal information, enable dark mode, and change the app's language." },
    ]
  },
  admin: {
    fr: [
      { icon: "🔐", title: "Se connecter à votre compte", text: "Connectez-vous avec votre email administrateur et votre mot de passe." },
      { icon: "📊", title: "Votre tableau de bord", text: "Le Dashboard offre une vue d'ensemble de toute la plateforme : nombre total de comptes, de patients et d'analyses effectuées, tous utilisateurs confondus." },
      { icon: "⚙️", title: "Créer un compte utilisateur", text: "Dans l'onglet Utilisateurs, ouvrez le sous-onglet \"Créer\". Renseignez le prénom, le nom, l'email, un mot de passe d'au moins 8 caractères, puis choisissez le rôle : Utilisateur, Radiologue ou Administrateur. Le compte est immédiatement actif et utilisable." },
      { icon: "🔄", title: "Changer le rôle d'un compte", text: "Depuis la liste des utilisateurs, appuyez sur \"Changer rôle\" sur la fiche d'un compte, puis sélectionnez le nouveau rôle. Comme il s'agit du même compte, toutes ses données personnelles (patients créés, analyses réalisées, abonnement en cours) restent automatiquement liées à la personne, quel que soit son nouveau rôle. La personne reçoit un email automatique l'informant du changement." },
      { icon: "🚫", title: "Activer ou désactiver un compte", text: "Appuyez sur \"Désactiver\" pour bloquer immédiatement l'accès d'un compte à l'application, ou sur \"Activer\" pour le restaurer. Un email de notification est envoyé automatiquement à chaque changement de statut." },
      { icon: "🗑️", title: "Supprimer un compte", text: "Appuyez sur \"Supprimer\" sur la fiche d'un utilisateur pour effacer définitivement son compte après confirmation dans la fenêtre d'alerte. La personne reçoit un email l'informant de la suppression. Cette action est irréversible." },
      { icon: "📋", title: "Consulter les journaux d'activité", text: "L'onglet Logs affiche l'historique complet des actions effectuées sur la plateforme (connexions, créations de comptes, suppressions de patients...), avec l'utilisateur concerné, l'action précise et la date exacte de chaque événement." },
      { icon: "🤖", title: "Gérer les modèles d'intelligence artificielle", text: "Dans l'onglet Modèles IA, consultez les modèles actuellement déployés (nom, architecture, version, précision). Activez ou désactivez un modèle avec le bouton dédié sur sa fiche, supprimez-en un si besoin, ou ajoutez-en un nouveau via \"+ Nouveau\" en renseignant son nom, son architecture, sa version et sa précision." },
      { icon: "👥", title: "Vue globale sur tous les patients", text: "Contrairement aux médecins et radiologues qui ne voient que leurs propres patients, vous avez accès à l'ensemble des dossiers créés par tous les utilisateurs de la plateforme, avec possibilité de les consulter ou de les supprimer si nécessaire." },
      { icon: "🔬", title: "Soumettre une analyse à un radiologue", text: "Comme un médecin, vous pouvez créer vos propres patients, lancer des analyses IA et soumettre un cas à un radiologue pour obtenir un avis médical, depuis l'onglet Chat en créant une nouvelle consultation." },
      { icon: "👤", title: "Personnaliser votre profil", text: "Dans l'onglet Profil, modifiez vos informations personnelles, activez le mode sombre et changez la langue de l'application." },
    ],
    en: [
      { icon: "🔐", title: "Signing in", text: "Sign in with your admin email and password." },
      { icon: "📊", title: "Your dashboard", text: "The Dashboard gives a full overview of the entire platform: total accounts, patients, and analyses performed, across every user." },
      { icon: "⚙️", title: "Creating a user account", text: "In the Users tab, open the \"Create\" sub-tab. Enter first name, last name, email, a password of at least 8 characters, then choose the role: User, Radiologist, or Admin. The account is immediately active and usable." },
      { icon: "🔄", title: "Changing an account's role", text: "From the user list, tap \"Change role\" on an account card, then select the new role. Since it's the same account, all of that person's personal data (patients created, analyses performed, active subscription) automatically stays linked to them, whatever their new role. The person receives an automatic email informing them of the change." },
      { icon: "🚫", title: "Activating or deactivating an account", text: "Tap \"Deactivate\" to immediately block an account's access to the app, or \"Activate\" to restore it. A notification email is automatically sent on every status change." },
      { icon: "🗑️", title: "Deleting an account", text: "Tap \"Delete\" on a user's card to permanently erase their account after confirming in the alert window. The person receives an email informing them of the deletion. This action is irreversible." },
      { icon: "📋", title: "Reviewing activity logs", text: "The Logs tab shows the full history of actions performed on the platform (logins, account creations, patient deletions...), with the user involved, the exact action, and the precise date of each event." },
      { icon: "🤖", title: "Managing AI models", text: "In the AI Models tab, view currently deployed models (name, architecture, version, accuracy). Activate or deactivate a model with the dedicated button on its card, delete one if needed, or add a new one via \"+ New\" by entering its name, architecture, version, and accuracy." },
      { icon: "👥", title: "Global view of all patients", text: "Unlike doctors and radiologists who only see their own patients, you have access to every record created by every user on the platform, with the ability to view or delete them if needed." },
      { icon: "🔬", title: "Submitting an analysis to a radiologist", text: "Like a doctor, you can create your own patients, run AI analyses, and submit a case to a radiologist for a medical opinion, from the Chat tab by creating a new consultation." },
      { icon: "👤", title: "Personalizing your profile", text: "In the Profile tab, edit your personal information, enable dark mode, and change the app's language." },
    ]
  }
};

const TITLES = {
  fr: { title: "À propos", subtitle: "Guide complet d'utilisation d'ARIA", contactBtn: "📧 Contacter le support", footer: "ARIA Medical — Plateforme de télé-radiologie assistée par intelligence artificielle. Conçu et développé au Cameroun." },
  en: { title: "About", subtitle: "Complete ARIA user guide", contactBtn: "📧 Contact support", footer: "ARIA Medical — AI-assisted tele-radiology platform. Designed and built in Cameroon." }
};

function Section({ icon, title, text, index }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.iconCircle}>
          <Text style={styles.sectionIcon}>{icon}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
}

export default function GuideScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, darkMode } = useSettings();
  const [lang, setLang] = useState("fr");

  const bg = darkMode ? theme.bg : colors.background;
  const surface = darkMode ? theme.surface : colors.surface;
  const textPrimary = darkMode ? theme.text : colors.textPrimary;
  const textMuted = darkMode ? theme.textMuted : colors.textMuted;

  const roleKey = user?.role === "admin" ? "admin" : user?.role === "radiologist" ? "radiologist" : "doctor";
  const t = TITLES[lang];
  const intro = INTRO[roleKey][lang];
  const sections = SECTIONS[roleKey][lang];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar backgroundColor={GUIDE_COLOR} barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ {lang === "fr" ? "Retour" : "Back"}</Text>
        </TouchableOpacity>

        <View style={styles.headerTop}>
          <AriaLogo size={56} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>{t.title}</Text>
            <Text style={styles.headerSub}>{t.subtitle}</Text>
          </View>
        </View>

        <View style={styles.langToggle}>
          <TouchableOpacity
            style={[styles.langBtn, lang === "fr" && styles.langBtnActive]}
            onPress={() => setLang("fr")}
          >
            <Text style={[styles.langText, lang === "fr" && styles.langTextActive]}>🇫🇷 Français</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, lang === "en" && styles.langBtnActive]}
            onPress={() => setLang("en")}
          >
            <Text style={[styles.langText, lang === "en" && styles.langTextActive]}>🇬🇧 English</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.introCard, { backgroundColor: surface }]}>
          <Text style={[styles.introText, { color: textPrimary }]}>{intro}</Text>
        </View>

        <View style={[styles.sectionsWrap, { backgroundColor: surface }]}>
          {sections.map((s, i) => (
            <Section key={i} icon={s.icon} title={s.title} text={s.text} index={i} />
          ))}
        </View>

        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => Linking.openURL("mailto:ariasecure.support@gmail.com?subject=" + encodeURIComponent("Support ARIA"))}
        >
          <Text style={styles.contactBtnText}>{t.contactBtn}</Text>
        </TouchableOpacity>

        <View style={styles.footerWrap}>
          <AriaLogo size={32} />
          <Text style={[styles.footerText, { color: textMuted }]}>{t.footer}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: GUIDE_COLOR,
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 18,
  },
  backBtn: { marginBottom: 12 },
  backText: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "600" },
  headerTop: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  langToggle: { flexDirection: "row", gap: 8 },
  langBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  langBtnActive: { backgroundColor: "#fff" },
  langText: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
  langTextActive: { color: GUIDE_COLOR },

  content: { padding: 16 },

  introCard: {
    borderRadius: radius.lg, padding: 16, marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: GUIDE_COLOR, ...shadows.small,
  },
  introText: { fontSize: 14, lineHeight: 21 },

  sectionsWrap: {
    borderRadius: radius.lg, padding: 4, marginBottom: 20, ...shadows.small,
  },
  section: { padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(15, 76, 129, 0.1)",
    alignItems: "center", justifyContent: "center",
  },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: GUIDE_COLOR, flex: 1 },
  sectionText: { fontSize: 13, lineHeight: 20, color: "#555" },

  contactBtn: {
    backgroundColor: GUIDE_COLOR, borderRadius: radius.lg,
    paddingVertical: 16, alignItems: "center", marginTop: 4, ...shadows.medium,
  },
  contactBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  footerWrap: { alignItems: "center", marginTop: 28, paddingHorizontal: 20 },
  footerText: { fontSize: 11, textAlign: "center", marginTop: 8, lineHeight: 16 },
});
