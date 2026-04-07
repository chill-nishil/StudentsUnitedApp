import { db } from "@/FirebaseConfig";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const BADGE_OPTIONS = [
  "Nature",
  "Robotics",
  "Technology",
  "Food",
  "Math",
  "Science",
  "Art",
  "Music",
  "Business",
  "Culture",
  "Service",
  "Sports"
];

export default function ClubInfoScreen() {
  const params = useLocalSearchParams<{ clubId?: string }>();
  const clubId = typeof params.clubId === "string" ? params.clubId : null;

  const [club, setClub] = useState<any>(null);
  const [currentUid, setCurrentUid] = useState("");
  const [isPresident, setIsPresident] = useState(false);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [customBadgeInput, setCustomBadgeInput] = useState("");
  const [isSavingBadges, setIsSavingBadges] = useState(false);

  const [aboutInput, setAboutInput] = useState("");
  const [rulesInput, setRulesInput] = useState("");
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  const [isPickingBackground, setIsPickingBackground] = useState(false);

  useEffect(() => {
    const auth = getAuth();

    const unsubAuth = onAuthStateChanged(auth, user => {
      setCurrentUid(user?.uid || "");
    });

    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!clubId) return;

    const clubRef = doc(db, "clubs", clubId);

    const unsub = onSnapshot(clubRef, snap => {
      if (!snap.exists()) return;

      const clubData = snap.data();
      const nextBadges = Array.isArray(clubData.focusBadges)
        ? clubData.focusBadges.filter((badge: any) => typeof badge === "string" && badge.trim())
        : [];

      setClub(clubData);
      setSelectedBadges(nextBadges);
      setAboutInput(typeof clubData.about === "string" ? clubData.about : "");
      setRulesInput(typeof clubData.rules === "string" ? clubData.rules : "");
      setIsPresident(!!currentUid && clubData.presidentId === currentUid);
    });

    return unsub;
  }, [clubId, currentUid]);

  const sortedSelectedBadges = useMemo(() => {
    return [...selectedBadges].sort((a, b) => a.localeCompare(b));
  }, [selectedBadges]);

  function normalizeBadgeText(text: string) {
    const trimmed = text.trim().replace(/\s+/g, " ");
    if (!trimmed) return "";
    return trimmed
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  function toggleBadge(badge: string) {
    if (!isPresident) return;

    setSelectedBadges(prev => {
      if (prev.some(item => item.toLowerCase() === badge.toLowerCase())) {
        return prev.filter(item => item.toLowerCase() !== badge.toLowerCase());
      }
      return [...prev, badge];
    });
  }

  function addCustomBadge() {
    if (!isPresident) return;

    const normalizedBadge = normalizeBadgeText(customBadgeInput);

    if (!normalizedBadge) return;

    setSelectedBadges(prev => {
      if (prev.some(item => item.toLowerCase() === normalizedBadge.toLowerCase())) {
        return prev;
      }
      return [...prev, normalizedBadge];
    });

    setCustomBadgeInput("");
  }

  async function saveBadges() {
    if (!clubId || !isPresident) {
      if (!isPresident) {
        Alert.alert("Only the president can edit club focus.");
      }
      return;
    }

    try {
      setIsSavingBadges(true);

      const clubRef = doc(db, "clubs", clubId);
      await updateDoc(clubRef, {
        focusBadges: sortedSelectedBadges
      });
    } finally {
      setIsSavingBadges(false);
    }
  }

  async function saveClubInfo() {
    if (!clubId || !isPresident) {
      if (!isPresident) {
        Alert.alert("Only the president can edit club info.");
      }
      return;
    }

    try {
      setIsSavingInfo(true);

      const clubRef = doc(db, "clubs", clubId);
      await updateDoc(clubRef, {
        about: aboutInput.trim(),
        rules: rulesInput.trim()
      });
    } finally {
      setIsSavingInfo(false);
    }
  }

  async function pickChatBackground() {
    if (!isPresident) return;
    if (!clubId) return;
    if (isPickingBackground) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;

    setIsPickingBackground(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [9, 16],
        quality: 0.3
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const manipulated = await manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.35, format: SaveFormat.JPEG, base64: true }
      );

      const base64 = manipulated.base64 || null;
      if (!base64) return;

      if (base64.length > 1100000) {
        console.log("BG_TOO_LARGE", base64.length);
        return;
      }

      const clubRef = doc(db, "clubs", clubId);
      await updateDoc(clubRef, { chatBackgroundBase64: base64 });
    } finally {
      setIsPickingBackground(false);
    }
  }

  async function clearChatBackground() {
    if (!isPresident) return;
    if (!clubId) return;

    Alert.alert("Remove background?", "This will reset the chat background for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const clubRef = doc(db, "clubs", clubId);
            await updateDoc(clubRef, { chatBackgroundBase64: null });
          } catch (e: any) {
            console.log("CLEAR_BG_ERROR", e?.code, e?.message, e);
          }
        }
      }
    ]);
  }

  if (!club) {
    return (
      <View style={styles.loadingWrap}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerTopRow}>
        <View style={styles.headerSide}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/calendar",
                params: {
                  clubId: clubId || "",
                  clubName: club.name || ""
                }
              })
            }
          >
            <Image
              source={require("../assets/images/calendarGraphic.png")}
              style={styles.headerIcon}
              resizeMode="contain"
            />
          </Pressable>
        </View>

        <View style={styles.headerCenterWrap}>
          <Text style={styles.clubName}>{club.name}</Text>
          {!!club.clubCode && (
            <Text style={styles.clubCode}>Code: {club.clubCode}</Text>
          )}
        </View>

        <View style={styles.headerSide} />
      </View>

      {!!club.imageBase64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${club.imageBase64}` }}
          style={styles.image}
        />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        {isPresident ? (
          <TextInput
            value={aboutInput}
            onChangeText={setAboutInput}
            placeholder="Write about your club"
            placeholderTextColor="#6B7280"
            style={[styles.customBadgeInput, styles.multilineInput]}
            multiline
            textAlignVertical="top"
          />
        ) : (
          <Text style={styles.sectionText}>
            {club.about || "No description yet."}
          </Text>
        )}
      </View>

      {isPresident && (
        <View style={styles.backgroundButtonsRow}>
          <Pressable
            style={styles.openCalendarButton}
            onPress={pickChatBackground}
            disabled={isPickingBackground}
          >
            <Text style={styles.openCalendarText}>
              {isPickingBackground ? "..." : "Chat Background"}
            </Text>
          </Pressable>

          {!!club.chatBackgroundBase64 && (
            <Pressable
              style={styles.openCalendarButton}
              onPress={clearChatBackground}
            >
              <Text style={styles.openCalendarText}>Remove Background</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rules</Text>
        {isPresident ? (
          <TextInput
            value={rulesInput}
            onChangeText={setRulesInput}
            placeholder="Write club rules"
            placeholderTextColor="#6B7280"
            style={[styles.customBadgeInput, styles.multilineInput]}
            multiline
            textAlignVertical="top"
          />
        ) : (
          <Text style={styles.sectionText}>
            {club.rules || "No rules added."}
          </Text>
        )}

        {isPresident && (
          <Pressable
            style={styles.saveButton}
            onPress={saveClubInfo}
            disabled={isSavingInfo}
          >
            <Text style={styles.saveButtonText}>
              {isSavingInfo ? "Saving..." : "Save Info"}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Club Focus</Text>

        <View style={styles.badgesWrap}>
          {BADGE_OPTIONS.map(badge => {
            const isSelected = selectedBadges.some(
              item => item.toLowerCase() === badge.toLowerCase()
            );

            return (
              <Pressable
                key={badge}
                style={[
                  styles.badge,
                  isSelected && styles.badgeSelected
                ]}
                onPress={() => toggleBadge(badge)}
                disabled={!isPresident}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isSelected && styles.badgeTextSelected
                  ]}
                >
                  {badge}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!!sortedSelectedBadges.length && (
          <View style={styles.selectedWrap}>
            <Text style={styles.selectedTitle}>Selected Focuses</Text>

            <View style={styles.badgesWrap}>
              {sortedSelectedBadges.map(badge => (
                <Pressable
                  key={badge}
                  style={styles.selectedBadge}
                  onPress={() => toggleBadge(badge)}
                  disabled={!isPresident}
                >
                  <Text style={styles.selectedBadgeText}>{badge}</Text>
                  {isPresident && <Text style={styles.removeBadgeText}> ×</Text>}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {isPresident && (
          <>
            <View style={styles.customBadgeRow}>
              <TextInput
                value={customBadgeInput}
                onChangeText={setCustomBadgeInput}
                placeholder="Add custom focus"
                placeholderTextColor="#6B7280"
                style={styles.customBadgeInput}
                maxLength={24}
              />

              <Pressable style={styles.addBadgeButton} onPress={addCustomBadge}>
                <Text style={styles.addBadgeButtonText}>Add</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.saveButton}
              onPress={saveBadges}
              disabled={isSavingBadges}
            >
              <Text style={styles.saveButtonText}>
                {isSavingBadges ? "Saving..." : "Save Badges"}
              </Text>
            </Pressable>
          </>
        )}

        {!sortedSelectedBadges.length && (
          <Text style={styles.sectionSubText}>
            No focus badges selected yet.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Club Stats</Text>
        <Text style={styles.sectionText}>
          Members: {club.members?.length || 0}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white"
  },
  content: {
    padding: 20,
    paddingBottom: 80
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10
  },
  headerSide: {
    width: 52,
    alignItems: "center",
    justifyContent: "center"
  },
  headerCenterWrap: {
    flex: 1,
    alignItems: "center"
  },
  headerIcon: {
    width: 45,
    height: 45,
    marginBottom: 20
    },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 16
  },
  clubName: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6
  },
  clubCode: {
    textAlign: "center",
    color: "#6B7280",
  },
  section: {
    marginTop: 14,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#F3F4F6"
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6
  },
  sectionText: {
    fontSize: 14,
    color: "#111827"
  },
  sectionSubText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 10
  },
  backgroundButtonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12
  },
  openCalendarButton: {
    backgroundColor: "#7b97d4",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignSelf: "center",
    marginTop: 10
  },
  openCalendarText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600"
  },
  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginRight: 8,
    marginBottom: 8
  },
  badgeSelected: {
    backgroundColor: "#7b97d4",
    borderColor: "#7b97d4"
  },
  badgeText: {
    color: "#111827",
    fontWeight: "500",
    fontSize: 13
  },
  badgeTextSelected: {
    color: "white",
    fontWeight: "600"
  },
  selectedWrap: {
    marginTop: 10
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8
  },
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    borderWidth: 1,
    borderColor: "#93C5FD",
    marginRight: 8,
    marginBottom: 8
  },
  selectedBadgeText: {
    color: "#1E3A8A",
    fontWeight: "600",
    fontSize: 13
  },
  removeBadgeText: {
    color: "#1E3A8A",
    fontWeight: "700",
    fontSize: 13
  },
  customBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12
  },
  customBadgeInput: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    marginRight: 8
  },
  multilineInput: {
    minHeight: 100,
    marginRight: 0
  },
  addBadgeButton: {
    backgroundColor: "#7b97d4",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  addBadgeButtonText: {
    color: "white",
    fontWeight: "600"
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: "#7b97d4",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center"
  },
  saveButtonText: {
    color: "white",
    fontWeight: "600"
  }
});





