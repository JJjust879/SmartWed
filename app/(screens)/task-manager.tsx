import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import Checkbox from "expo-checkbox";
import * as Notifications from "expo-notifications";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars"; 
import BottomNav from "../components/BottomNav";

// Firebase
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { app } from "../../firebaseConfig";

const db = getFirestore(app);

type Task = {
  id: string;
  title: string;
  dueDate?: Date | null;
  completed: boolean;
  note?: string;
};

type Todo = {
  id: string;
  text: string;
  completed: boolean;
};

export default function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);

  // --- Date picker states ---
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [activeTab, setActiveTab] = useState<"InProgress" | "Completed">(
    "InProgress"
  );

  // ---- Todo states ----
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [todoModalVisible, setTodoModalVisible] = useState(false);

  // ---- Calendar ----
  const [calendarVisible, setCalendarVisible] = useState(false);

  // ---- Firestore listeners ----
  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem("@uid");
      if (!uid) return;

      const tasksRef = collection(db, "users", uid, "tasks");
      const q = query(tasksRef, orderBy("createdAt", "desc"));

      return onSnapshot(q, (snapshot) => {
        const fetched: Task[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title,
            note: data.note || "",
            dueDate: data.dueDate ? data.dueDate.toDate() : null,
            completed: data.completed || false,
          };
        });
        setTasks(fetched);
      });
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem("@uid");
      if (!uid) return;

      const todosRef = collection(db, "users", uid, "todos");
      const q = query(todosRef, orderBy("createdAt", "desc"));

      return onSnapshot(q, (snapshot) => {
        const fetched: Todo[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            text: data.text,
            completed: data.completed || false,
          };
        });
        setTodos(fetched);
      });
    })();
  }, []);

  // ---- Notifications ----
  const scheduleNotification = async (taskTitle: string, date: Date) => {
    const triggerTime = new Date(date.getTime() - 10 * 60 * 1000);
    if (triggerTime > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "Upcoming Task", body: `${taskTitle} is due soon!` },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerTime,
        },
      });
    }
  };

  // ---- Task CRUD ----
  const addTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert("Error", "Please enter a task title");
      return;
    }

    const uid = await AsyncStorage.getItem("@uid");
    if (!uid) return;

    const tasksRef = collection(db, "users", uid, "tasks");

    await addDoc(tasksRef, {
      title: taskTitle,
      note: taskNote.trim() || "",
      dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
      completed: false,
      createdAt: serverTimestamp(),
    });

    if (dueDate) await scheduleNotification(taskTitle, dueDate);

    setTaskTitle("");
    setTaskNote("");
    setDueDate(null);
    setModalVisible(false);
  };

  const toggleTaskCompletion = async (taskId: string, currentStatus: boolean) => {
    const uid = await AsyncStorage.getItem("@uid");
    if (!uid) return;
    const taskRef = doc(db, "users", uid, "tasks", taskId);
    await updateDoc(taskRef, { completed: !currentStatus });
  };

  const deleteTask = async (taskId: string) => {
    Alert.alert("Confirm Delete", "Delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const uid = await AsyncStorage.getItem("@uid");
          if (!uid) return;
          const taskRef = doc(db, "users", uid, "tasks", taskId);
          await deleteDoc(taskRef);
          setDetailsVisible(false);
        },
      },
    ]);
  };

  const saveTaskNote = async () => {
    if (!selectedTask) return;
    const uid = await AsyncStorage.getItem("@uid");
    if (!uid) return;
    const taskRef = doc(db, "users", uid, "tasks", selectedTask.id);
    await updateDoc(taskRef, { note: selectedTask.note || "" });
    setDetailsVisible(false);
  };

  // ---- Todo CRUD ----
  const addTodo = async () => {
    if (!newTodo.trim()) return;
    const uid = await AsyncStorage.getItem("@uid");
    if (!uid) return;
    const todosRef = collection(db, "users", uid, "todos");
    await addDoc(todosRef, {
      text: newTodo.trim(),
      completed: false,
      createdAt: serverTimestamp(),
    });
    setNewTodo("");
  };

  const toggleTodo = async (todoId: string, currentStatus: boolean) => {
    const uid = await AsyncStorage.getItem("@uid");
    if (!uid) return;
    const todoRef = doc(db, "users", uid, "todos", todoId);
    await updateDoc(todoRef, { completed: !currentStatus });
  };

  const deleteTodo = async (todoId: string) => {
    Alert.alert("Confirm Delete", "Delete this to-do?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const uid = await AsyncStorage.getItem("@uid");
          if (!uid) return;
          const todoRef = doc(db, "users", uid, "todos", todoId);
          await deleteDoc(todoRef);
        },
      },
    ]);
  };

  const renderTodo = ({ item }: { item: Todo }) => {
    return (
      <View style={styles.todoItem}>
        <Checkbox
          value={item.completed}
          onValueChange={() => toggleTodo(item.id, item.completed)}
          color={item.completed ? "#d6336c" : undefined}
        />
        <Text
          style={[
            styles.todoText,
            item.completed && { textDecorationLine: "line-through", color: "#888" },
          ]}
        >
          {item.text}
        </Text>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.todoDelete}
          onPress={() => deleteTodo(item.id)}
        >
          <Ionicons name="trash" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  // ---- Calendar Markings ----
  const markedDates = tasks.reduce((acc, task) => {
    if (task.dueDate) {
      const localDate = new Date(
        task.dueDate.getTime() - task.dueDate.getTimezoneOffset() * 60000
      )
        .toISOString()
        .split("T")[0];

      acc[localDate] = { marked: true, dotColor: task.completed ? "green" : "red" };
    }
    return acc;
  }, {} as Record<string, any>);


  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>Task Manager</Text>
        <TouchableOpacity style={styles.addButtonTop} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {["InProgress", "Completed"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "InProgress" ? "In Progress" : "Completed"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task list */}
      <FlatList
        data={tasks.filter((t) => (activeTab === "InProgress" ? !t.completed : t.completed))}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.taskItem}>
            <Checkbox
              value={item.completed}
              onValueChange={() => toggleTaskCompletion(item.id, item.completed)}
              color={item.completed ? "#d6336c" : undefined}
            />
            <TouchableOpacity
              style={{ flex: 1, marginLeft: 10 }}
              onPress={() => {
                setSelectedTask(item);
                setDetailsVisible(true);
              }}
            >
              <Text
                style={[
                  styles.taskText,
                  item.completed && { textDecorationLine: "line-through", color: "#888" },
                ]}
              >
                {item.title}
              </Text>
              {item.dueDate && (
                <Text style={styles.dueDate}>Due: {item.dueDate.toLocaleString()}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Floating Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabButton} onPress={() => setTodoModalVisible(true)}>
          <Ionicons name="list" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabButton} onPress={() => setCalendarVisible(true)}>
          <Ionicons name="calendar" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Add Task Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>New Task</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter task..."
              value={taskTitle}
              onChangeText={setTaskTitle}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Add a note (optional)"
              value={taskNote}
              onChangeText={setTaskNote}
              multiline
            />

            {/* Due Date Picker */}
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateText}>
                {dueDate ? dueDate.toLocaleString() : "Pick Due Date"}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={new Date()}
                mode="date"
                display="calendar"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (event.type === "dismissed") return;
                  if (selectedDate) {
                    setTempDate(selectedDate);
                    setShowTimePicker(true);
                  }
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={tempDate || new Date()}
                mode="time"
                display="spinner"
                onChange={(event, selectedTime) => {
                  setShowTimePicker(false);
                  if (event.type === "dismissed") return;
                  if (selectedTime && tempDate) {
                    const combined = new Date(tempDate);
                    combined.setHours(selectedTime.getHours());
                    combined.setMinutes(selectedTime.getMinutes());
                    setDueDate(combined);
                  }
                }}
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.addButtonTop, { flex: 1, marginRight: 5 }]}
                onPress={addTask}
              >
                <Text style={{ color: "#fff", fontWeight: "600", textAlign: "center" }}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteButton, { flex: 1, marginLeft: 5 }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ color: "#fff", fontWeight: "600", textAlign: "center" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* To-Do Modal */}
      <Modal visible={todoModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { height: "70%" }]}>
            <Text style={styles.modalHeader}>To-Do List</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 10 }]}
                placeholder="New To-Do"
                value={newTodo}
                onChangeText={setNewTodo}
              />
              <TouchableOpacity style={styles.addButtonTop} onPress={addTodo}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList data={todos} keyExtractor={(item) => item.id} renderItem={renderTodo} />
            <TouchableOpacity
              style={[styles.addButtonTop, { marginTop: 10 }]}
              onPress={() => setTodoModalVisible(false)}
            >
              <Text style={{ color: "#fff", textAlign: "center" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Task Details Modal */}
      <Modal visible={detailsVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Task Details</Text>
            {selectedTask && (
              <>
                <Text style={{ fontWeight: "600" }}>Title</Text>
                <TextInput style={styles.input} value={selectedTask.title} editable={false} />
                <Text style={{ fontWeight: "600" }}>Note</Text>
                <TextInput
                  style={[styles.input, { height: 100 }]}
                  multiline
                  value={selectedTask.note || ""}
                  onChangeText={(text) => setSelectedTask({ ...selectedTask, note: text })}
                />
                {selectedTask.dueDate && (
                  <Text style={{ marginBottom: 10 }}>
                    Due: {selectedTask.dueDate.toLocaleString()}
                  </Text>
                )}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.addButtonTop, { flex: 1, marginRight: 5 }]}
                    onPress={saveTaskNote}
                  >
                    <Text style={{ color: "#fff", textAlign: "center" }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteButton, { flex: 1, marginLeft: 5 }]}
                    onPress={() => deleteTask(selectedTask.id)}
                  >
                    <Text style={{ color: "#fff", textAlign: "center" }}>Delete</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.addButtonTop, { marginTop: 10 }]}
                  onPress={() => setDetailsVisible(false)}
                >
                  <Text style={{ color: "#fff", textAlign: "center" }}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Calendar Modal */}
      <Modal visible={calendarVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { height: "70%" }]}>
            <Text style={styles.modalHeader}>Calendar</Text>
            <Calendar
              markedDates={markedDates}
              onDayPress={(day) => {
                const selectedTasks = tasks.filter(
                  (t) => t.dueDate && t.dueDate.toISOString().split("T")[0] === day.dateString
                );
                if (selectedTasks.length) {
                  Alert.alert(
                    "Tasks on " + day.dateString,
                    selectedTasks.map((t) => t.title).join("\n")
                  );
                }
              }}
            />
            <TouchableOpacity
              style={[styles.addButtonTop, { marginTop: 10 }]}
              onPress={() => setCalendarVisible(false)}
            >
              <Text style={{ color: "#fff", textAlign: "center" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <BottomNav />
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  header: { fontSize: 22, fontWeight: "700", color: "#d6336c" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  addButtonTop: { backgroundColor: "#d6336c", padding: 10, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabContainer: { flexDirection: "row", backgroundColor: "#f1cce0", borderRadius: 25, padding: 4, marginBottom: 10 },
  tabPill: { flex: 1, paddingVertical: 10, borderRadius: 25, alignItems: "center" },
  tabPillActive: { backgroundColor: "#d6336c" },
  tabText: { color: "#d6336c", fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  taskItem: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#f8d7e5", borderRadius: 10, marginBottom: 10 },
  taskText: { fontSize: 16, fontWeight: "600", color: "#333" },
  dueDate: { fontSize: 14, color: "#555", marginTop: 4 },
  deleteButton: { backgroundColor: "#d6336c", padding: 8, borderRadius: 8, marginLeft: 8 },
  subHeader: { fontSize: 18, fontWeight: "700", marginTop: 20, marginBottom: 10, color: "#d6336c" },
  todoInputRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  todoInput: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 10, marginRight: 10 },
  todoItem: {
  flexDirection: "row",
  alignItems: "center",
  padding: 12,
  backgroundColor: "#f9f9f9",
  borderRadius: 10,
  marginBottom: 8,
  justifyContent: "space-between",
  },
  todoText: {
    flex: 1, // take all remaining space
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "500",
  },
  todoDelete: {
    backgroundColor: "#d6336c",
    justifyContent: "center",
    alignItems: "center",
    width: 40,
    height: 40,
    borderRadius: 10,
    marginLeft: 10,
  },
  modalContainer: { flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { backgroundColor: "#fff", padding: 20, borderRadius: 10, margin: 20 },
  modalHeader: { fontSize: 20, fontWeight: "700", marginBottom: 10, color: "#d6336c" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 10, marginBottom: 10 },
  dateButton: { backgroundColor: "#f8d7e5", padding: 10, borderRadius: 10, alignItems: "center", marginBottom: 10 },
  dateText: { fontSize: 16, color: "#333" },
  modalButtons: { flexDirection: "row", marginTop: 10 },
    fabContainer: {
    position: "absolute",
    bottom: 80,
    right: 20,
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  fabButton: {
    backgroundColor: "#d6336c",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5, // shadow on Android
    shadowColor: "#000", // shadow on iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});
