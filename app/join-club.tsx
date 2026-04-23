import { db } from "@/FirebaseConfig";
import { router } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const POSITION_OPTIONS = [
  "New Member",
  "Recurring Member",
  "Board Member",
  "Other Position"
] as const;

const SORT_OPTIONS = [
  "A-Z",
  "Members"
] as const;

const CLUB_FILTER_OPTIONS = [
  "All Clubs",
  "Joined Clubs",
  "Clubs Not Joined"
] as const;

type SortOption = (typeof SORT_OPTIONS)[number];
type ClubFilterOption = (typeof CLUB_FILTER_OPTIONS)[number];

export default function JoinClubScreen() {
  const auth = getAuth();
  const currentUid = auth.currentUser?.uid;

  const [searchText, setSearchText] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("");
  const [otherPosition, setOtherPosition] = useState("");
  const [allClubs, setAllClubs] = useState<any[]>([]);
  const [clubResults, setClubResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [joinedClubIds, setJoinedClubIds] = useState<string[]>([]);
  const [pendingClubRequests, setPendingClubRequests] = useState<string[]>([]);
  const [positionOpenClubId, setPositionOpenClubId] = useState<string | null>(null);

  const [selectedSort, setSelectedSort] = useState<SortOption>("A-Z");
  const [selectedClubFilter, setSelectedClubFilter] =
    useState<ClubFilterOption>("All Clubs");
  const [selectedBadgeFilter, setSelectedBadgeFilter] = useState("All");

  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [showDropdownOpen, setShowDropdownOpen] = useState(false);
  const [badgeDropdownOpen, setBadgeDropdownOpen] = useState(false);

  const hasAutoNavigatedRef = useRef(false);

  // Tracks previous joined club count so the screen knows when a new club was added
  const previousClubCount = useRef(0);

  useEffect(() => {
    if (!currentUid) return;

    const userRef = doc(db, "users", currentUid);

    const unsub = onSnapshot(userRef, snap => {
      if (!snap.exists()) return;

      const data = snap.data();

      const nextJoinedClubIds = Array.isArray(data.clubIds) ? data.clubIds : [];
      const nextPendingClubRequests = Array.isArray(data.pendingClubRequests)
        ? data.pendingClubRequests
        : [];

      setJoinedClubIds(nextJoinedClubIds);
      setPendingClubRequests(nextPendingClubRequests);

      // If the user just got accepted into a new club, send them back to the dashboard once
      if (
        nextJoinedClubIds.length > previousClubCount.current &&
        previousClubCount.current !== 0 &&
        !hasAutoNavigatedRef.current
      ) {
        hasAutoNavigatedRef.current = true;
        router.dismissTo("/chat-dashboard");
      }

      previousClubCount.current = nextJoinedClubIds.length;
    });

    return unsub;
  }, [currentUid]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "clubs"), snap => {
      const clubs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setAllClubs(clubs);
    });

    return unsub;
  }, []);

  const badgeOptions = useMemo(() => {
    // Build a unique list of all focus badges used across clubs
    const badgeMap = new Map<string, string>();

    allClubs.forEach(club => {
      const focusBadges = Array.isArray(club.focusBadges) ? club.focusBadges : [];

      focusBadges.forEach((badge: any) => {
        if (typeof badge !== "string") return;

        const trimmed = badge.trim();
        if (!trimmed) return;

        const normalizedKey = trimmed.toLowerCase();
        if (!badgeMap.has(normalizedKey)) {
          badgeMap.set(normalizedKey, trimmed);
        }
      });
    });

    return ["All", ...Array.from(badgeMap.values()).sort((a, b) => a.localeCompare(b))];
  }, [allClubs]);

  useEffect(() => {
    if (
      selectedBadgeFilter !== "All" &&
      !badgeOptions.includes(selectedBadgeFilter)
    ) {
      setSelectedBadgeFilter("All");
    }
  }, [badgeOptions, selectedBadgeFilter]);

  useEffect(() => {
    const search = searchText.trim().toUpperCase();

    setError("");
    setSelectedPosition("");
    setOtherPosition("");
    setPositionOpenClubId(null);

    let results = [...allClubs];

    if (selectedClubFilter === "Joined Clubs") {
      results = results.filter(club => joinedClubIds.includes(club.id));
    } else if (selectedClubFilter === "Clubs Not Joined") {
      results = results.filter(club => !joinedClubIds.includes(club.id));
    }

    // Filter by selected focus badge
    if (selectedBadgeFilter !== "All") {
      results = results.filter(club => {
        const focusBadges = Array.isArray(club.focusBadges) ? club.focusBadges : [];
        return focusBadges.some(
          (badge: any) =>
            typeof badge === "string" &&
            badge.trim().toLowerCase() === selectedBadgeFilter.trim().toLowerCase()
        );
      });
    }

    // Search by club name, club code, or focus badges
    if (search) {
      const words = search.split(/\s+/).filter(Boolean);

      results = results.filter(club => {
        const clubName =
          typeof club.name === "string" ? club.name.toUpperCase() : "";

        const clubCode =
          typeof club.clubCode === "string" ? club.clubCode.toUpperCase() : "";

        const focusBadges = Array.isArray(club.focusBadges)
          ? club.focusBadges
              .filter((badge: any) => typeof badge === "string")
              .join(" ")
              .toUpperCase()
          : "";

        return words.every(
          word =>
            clubName.includes(word) ||
            clubCode.includes(word) ||
            focusBadges.includes(word)
        );
      });
    }

    results.sort((a, b) => {
      if (selectedSort === "Members") {
        const aCount = Array.isArray(a.members) ? a.members.length : 0;
        const bCount = Array.isArray(b.members) ? b.members.length : 0;

        if (bCount !== aCount) {
          return bCount - aCount;
        }
      }

      const aName = typeof a.name === "string" ? a.name : "";
      const bName = typeof b.name === "string" ? b.name : "";
      return aName.localeCompare(bName);
    });

    setClubResults(results);

    if (results.length === 0) {
      setError("No clubs match your filters");
    }
  }, [
    searchText,
    allClubs,
    joinedClubIds,
    selectedSort,
    selectedClubFilter,
    selectedBadgeFilter
  ]);

  async function sendJoinRequest(clubResult: any) {
    if (!clubResult || !currentUid) return;

    const cleanOtherPosition = otherPosition.trim();

    let finalPosition = selectedPosition;

    if (!selectedPosition) {
      setError("Choose a position for this club");
      return;
    }

    if (selectedPosition === "Other Position") {
      if (!cleanOtherPosition) {
        setError("Enter your position for this club");
        return;
      }
      finalPosition = cleanOtherPosition;
    }

    if (joinedClubIds.includes(clubResult.id)) {
      setError("You are already in this club");
      return;
    }

    if (pendingClubRequests.includes(clubResult.id)) {
      setError("You already sent a request to this club");
      return;
    }

    const clubRef = doc(db, "clubs", clubResult.id);
    const userRef = doc(db, "users", currentUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      setError("User profile not found");
      return;
    }

    const userData = userSnap.data();
    const requesterName =
      typeof userData.name === "string" ? userData.name.trim() : "";

    await updateDoc(clubRef, {
      joinRequests: arrayUnion({
        uid: currentUid,
        name: requesterName,
        position: finalPosition,
        requestedAt: new Date()
      })
    });

    await updateDoc(userRef, {
      pendingClubRequests: arrayUnion(clubResult.id)
    });

    setError("");
    setSelectedPosition("");
    setOtherPosition("");
    setPositionOpenClubId(null);
  }

  function closeTopDropdowns() {
    setSortDropdownOpen(false);
    setShowDropdownOpen(false);
    setBadgeDropdownOpen(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#dbeafe" }} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonArrow}>‹</Text>
          </Pressable>

          <Text style={styles.title}>Join a Club</Text>

          <View style={styles.headerRightSpacer} />
        </View>

        <Text style={styles.subtitle}>Find clubs that match your interests</Text>

        <TextInput
          placeholder="Search clubs"
          placeholderTextColor="#4B5563"
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="characters"
          style={styles.input}
          onFocus={closeTopDropdowns}
        />

        <View style={styles.topFiltersRow}>
          <View style={styles.dropdownWrap}>
            <Text style={styles.dropdownLabel}>Sort</Text>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => {
                setSortDropdownOpen(prev => !prev);
                setShowDropdownOpen(false);
                setBadgeDropdownOpen(false);
              }}
            >
              <Text style={styles.dropdownButtonText}>{selectedSort}</Text>
              <Text style={styles.dropdownArrow}>{sortDropdownOpen ? "▲" : "▼"}</Text>
            </Pressable>

            {sortDropdownOpen && (
              <View style={styles.dropdownMenu}>
                {SORT_OPTIONS.map(option => {
                  const isSelected = selectedSort === option;

                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.dropdownOption,
                        isSelected && styles.dropdownOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedSort(option);
                        setSortDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          isSelected && styles.dropdownOptionTextSelected
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.dropdownWrap}>
            <Text style={styles.dropdownLabel}>Show</Text>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => {
                setShowDropdownOpen(prev => !prev);
                setSortDropdownOpen(false);
                setBadgeDropdownOpen(false);
              }}
            >
              <Text style={styles.dropdownButtonText}>{selectedClubFilter}</Text>
              <Text style={styles.dropdownArrow}>{showDropdownOpen ? "▲" : "▼"}</Text>
            </Pressable>

            {showDropdownOpen && (
              <View style={styles.dropdownMenu}>
                {CLUB_FILTER_OPTIONS.map(option => {
                  const isSelected = selectedClubFilter === option;

                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.dropdownOption,
                        isSelected && styles.dropdownOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedClubFilter(option);
                        setShowDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          isSelected && styles.dropdownOptionTextSelected
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.dropdownWrap}>
            <Text style={styles.dropdownLabel}>Focus</Text>
            <Pressable
              style={styles.dropdownButton}
              onPress={() => {
                setBadgeDropdownOpen(prev => !prev);
                setSortDropdownOpen(false);
                setShowDropdownOpen(false);
              }}
            >
              <Text style={styles.dropdownButtonText} numberOfLines={1}>
                {selectedBadgeFilter}
              </Text>
              <Text style={styles.dropdownArrow}>{badgeDropdownOpen ? "▲" : "▼"}</Text>
            </Pressable>

            {badgeDropdownOpen && (
              <View style={styles.dropdownMenu}>
                {badgeOptions.map(option => {
                  const isSelected = selectedBadgeFilter === option;

                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.dropdownOption,
                        isSelected && styles.dropdownOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedBadgeFilter(option);
                        setBadgeDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          isSelected && styles.dropdownOptionTextSelected
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        <Text style={styles.searchHint}>
          {clubResults.length} club{clubResults.length === 1 ? "" : "s"} shown
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {clubResults.map(clubResult => {
          const currentClubAlreadyRequested = pendingClubRequests.includes(clubResult.id);
          const currentClubAlreadyJoined = joinedClubIds.includes(clubResult.id);
          const positionOpen = positionOpenClubId === clubResult.id;
          const memberCount = Array.isArray(clubResult.members)
            ? clubResult.members.length
            : 0;
          const focusBadges = Array.isArray(clubResult.focusBadges)
            ? clubResult.focusBadges.filter(
                (badge: any) => typeof badge === "string" && badge.trim()
              )
            : [];

          return (
            <View key={clubResult.id} style={styles.result}>
              <View style={styles.cardAccent} />

              <View style={styles.cardHeaderRow}>
                <Text style={styles.clubName}>{clubResult.name}</Text>
                <View style={styles.codePill}>
                  <Text style={styles.codePillText}>
                    Code: {clubResult.clubCode || "No Code"}
                  </Text>
                </View>
              </View>

              <Text style={styles.memberCount}>Members: {memberCount}</Text>

              {!!focusBadges.length && (
                <View style={styles.badgesWrap}>
                  {focusBadges.map((badge: string) => (
                    <View key={`${clubResult.id}-${badge}`} style={styles.badge}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  ))}
                </View>
              )}

              {currentClubAlreadyJoined ? (
                <View style={styles.statusBox}>
                  <Text style={styles.pendingText}>
                    You are already in this club.
                  </Text>
                </View>
              ) : currentClubAlreadyRequested ? (
                <View style={styles.statusBox}>
                  <Text style={styles.pendingText}>
                    Request sent. Waiting for approval.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.actionSection}>
                    <Pressable
                      style={styles.positionHeader}
                      onPress={() => {
                        closeTopDropdowns();

                        if (positionOpen) {
                          setPositionOpenClubId(null);
                        } else {
                          setPositionOpenClubId(clubResult.id);
                          setSelectedPosition("");
                          setOtherPosition("");
                        }
                      }}
                    >
                      <Text style={styles.positionTitle}>Choose your position</Text>
                      <Text style={styles.positionArrow}>
                        {positionOpen ? "▲" : "▼"}
                      </Text>
                    </Pressable>

                    {positionOpen && (
                      <View style={styles.positionOptionsWrap}>
                        {POSITION_OPTIONS.map(option => {
                          const isSelected = selectedPosition === option;

                          return (
                            <Pressable
                              key={option}
                              style={[
                                styles.positionOption,
                                isSelected && styles.positionOptionSelected
                              ]}
                              onPress={() => {
                                setSelectedPosition(option);
                                if (option !== "Other Position") {
                                  setOtherPosition("");
                                }
                              }}
                            >
                              <Text
                                style={[
                                  styles.positionOptionText,
                                  isSelected && styles.positionOptionTextSelected
                                ]}
                              >
                                {option}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}

                    {positionOpen && selectedPosition === "Other Position" && (
                      <TextInput
                        placeholder="Enter your position"
                        placeholderTextColor="#4B5563"
                        value={otherPosition}
                        onChangeText={setOtherPosition}
                        style={styles.otherPositionInput}
                      />
                    )}
                  </View>

                  <Pressable
                    style={styles.joinButton}
                    onPress={() => sendJoinRequest(clubResult)}
                  >
                    <Text style={styles.joinText}>Send Join Request</Text>
                  </Pressable>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#dbeafe"
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 120,
  },
  topBar: {
    alignItems: "flex-start",
    marginBottom: 8
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE"
  },
  backButtonArrow: {
    fontSize: 22,
    lineHeight: 22,
    color: "#365E95",
    marginRight: 4,
    fontWeight: "600"
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#365E95"
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    color: "#111827"
  },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 18
  },
  input: {
    borderWidth: 1,
    borderColor: "#D6DEEB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#7C8FB5",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  topFiltersRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 1000,
    marginBottom: 8
  },
  dropdownWrap: {
    flex: 1,
    position: "relative"
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    marginLeft: 8
  },
  dropdownButton: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#7C8FB5",
    shadowOpacity: 0.05,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  dropdownButtonText: {
    color: "#111827",
    fontWeight: "500",
    fontSize: 12,
    flex: 1,
    marginRight: 10
  },
  dropdownArrow: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600"
  },
  dropdownMenu: {
    position: "absolute",
    top: 78,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    zIndex: 2000,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    overflow: "hidden"
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF"
  },
  dropdownOptionSelected: {
    backgroundColor: "#EEF2FF"
  },
  dropdownOptionText: {
    color: "#111827",
    fontWeight: "500",
    fontSize: 9
  },
  dropdownOptionTextSelected: {
    color: "#365E95",
    fontWeight: "600"
  },
  searchHint: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 6
  },
  error: {
    marginTop: 12,
    color: "red",
    textAlign: "center"
  },
  result: {
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DCE6F5",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    shadowColor: "#6B7FA5",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
    overflow: "hidden"
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: "#7B97D4"
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4,
    marginBottom: 8
  },
  clubName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827"
  },
  codePill: {
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D4E0F6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  codePillText: {
    color: "#365E95",
    fontWeight: "600",
    fontSize: 11
  },
  memberCount: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8
  },
  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
    marginBottom: 8
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#D6E2FA",
    marginRight: 8,
    marginBottom: 8
  },
  badgeText: {
    color: "#365E95",
    fontWeight: "600",
    fontSize: 12
  },
  statusBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 4
  },
  pendingText: {
    marginTop: 0,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 14
  },
  actionSection: {
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#DCE6F5",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12
  },
  positionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0
  },
  positionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827"
  },
  positionArrow: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280"
  },
  positionOptionsWrap: {
    marginTop: 12,
    marginBottom: 0
  },
  positionOption: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: "#FFFFFF"
  },
  positionOptionSelected: {
    backgroundColor: "#7b97d4",
    borderColor: "#7b97d4"
  },
  positionOptionText: {
    color: "#111827",
    textAlign: "center",
    fontWeight: "500"
  },
  positionOptionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600"
  },
  otherPositionInput: {
    borderWidth: 1,
    borderColor: "#D6DEEB",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#FFFFFF",
    marginTop: 4
  },
  joinButton: {
    backgroundColor: "#6B7FA5",
    padding: 10,
    borderRadius: 10,
    shadowColor: "#365E95",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  joinText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "600"
  },
  headerRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 6,
  },
  headerRightSpacer: {
    width: 28, // same width as back button to keep title centered
  }
});