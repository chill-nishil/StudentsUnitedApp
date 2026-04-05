import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function BottomNav() {
  const pathname = usePathname();

  const isHome = pathname === "/general-dashboard";
  const isCalendar = pathname === "/general-calendar";
  const isChats = pathname === "/chat-dashboard";

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.tab, isHome && styles.activeTab]}
        onPress={() => router.replace("/general-dashboard")}
      >
        <Text style={[styles.tabText, isHome && styles.activeTabText]}>
          Home
        </Text>
      </Pressable>

      <Pressable
        style={[styles.tab, isChats && styles.activeTab]}
        onPress={() => router.replace("/chat-dashboard")}
      >
        <Text style={[styles.tabText, isChats && styles.activeTabText]}>
          Chats
        </Text>
      </Pressable>

      <Pressable
        style={[styles.tab, isCalendar && styles.activeTab]}
        onPress={() => router.replace("/general-calendar")}
      >
        <Text style={[styles.tabText, isCalendar && styles.activeTabText]}>
          Calendar
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 12
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12
  },
  activeTab: {
    backgroundColor: "#dbeafe"
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151"
  },
  activeTabText: {
    color: "#224bc5"
  }
});