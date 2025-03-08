import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "./firebaseConfig";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [registerStep, setRegisterStep] = useState(null); // Track registration step
  const [registerData, setRegisterData] = useState({
    email: "",
    password: "",
    characterName: "",
  });
  const [loginStep, setLoginStep] = useState(null); // Track login step
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Create socket connection
    const socket = io("http://localhost:3000");
    socketRef.current = socket;

    // Handle connection events
    socket.on("connect", () => {
      console.log("Connected to server");
      setConnected(true);
    });

    // Handle messages from server
    socket.on("message", (message) => {
      console.log("Received message:", message);
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setConnected(false);
    });

    // Clean up on component unmount
    return () => {
      socket.disconnect();
    };
  }, []); // Empty dependency array ensures this runs once on mount

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;

    if (registerStep) {
      // Handle registration steps
      switch (registerStep) {
        case "email":
          setRegisterData({ ...registerData, email: input });
          setRegisterStep("password");
          setMessages((prevMessages) => [
            ...prevMessages,
            "Type your password:",
          ]);
          break;
        case "password":
          setRegisterData({ ...registerData, password: input });
          setRegisterStep("characterName");
          setMessages((prevMessages) => [
            ...prevMessages,
            "Name your character:",
          ]);
          break;
        case "characterName":
          setRegisterData({ ...registerData, characterName: input });
          try {
            const { email, password, characterName } = registerData;
            const userCredential = await createUserWithEmailAndPassword(
              auth,
              email,
              password
            );
            const idToken = await userCredential.user.getIdToken();
            socketRef.current.emit("register", { idToken, characterName });
            setMessages((prevMessages) => [
              ...prevMessages,
              "Registration successful. Please log in.",
            ]);
            setRegisterStep(null);
          } catch (error) {
            console.error("Registration failed:", error.message);
            setMessages((prevMessages) => [
              ...prevMessages,
              "Registration failed",
            ]);
            setRegisterStep(null);
          }
          break;
        default:
          break;
      }
    } else if (loginStep) {
      // Handle login steps
      switch (loginStep) {
        case "email":
          setLoginData({ ...loginData, email: input });
          setLoginStep("password");
          setMessages((prevMessages) => [
            ...prevMessages,
            "Type your password:",
          ]);
          break;
        case "password":
          // Update loginData with the current input value
          const updatedLoginData = { ...loginData, password: input };
          setLoginData(updatedLoginData);
          try {
            const { email, password } = updatedLoginData; // Use the updated loginData
            const userCredential = await signInWithEmailAndPassword(
              auth,
              email,
              password
            );
            const idToken = await userCredential.user.getIdToken();
            socketRef.current.emit("login", idToken);
            setMessages((prevMessages) => [
              ...prevMessages,
              "Login successful",
            ]);
            setLoggedIn(true);
            setLoginStep(null);
          } catch (error) {
            console.error("Login failed:", error.message);
            setMessages((prevMessages) => [...prevMessages, "Login failed"]);
            setLoginStep(null);
          }
          break;
        default:
          break;
      }
    } else {
      // Handle initial commands
      if (input.toLowerCase() === "register") {
        setRegisterStep("email");
        setMessages((prevMessages) => [...prevMessages, "Type your email:"]);
      } else if (input.toLowerCase() === "login") {
        setLoginStep("email");
        setMessages((prevMessages) => [...prevMessages, "Type your email:"]);
      } else if (loggedIn) {
        // Handle command
        socketRef.current.emit("command", input);
      } else {
        setMessages((prevMessages) => [
          ...prevMessages,
          "Please log in to send commands",
        ]);
      }
    }

    setInput("");
  };

  return (
    <div className="mud-client">
      <div className="game-window">
        <div className="message-area">
          {messages.map((msg, index) => (
            <div key={index} className="message">
              {msg}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="input-area">
          <div className="input-container">
            <input
              type={
                registerStep === "password" || loginStep === "password"
                  ? "password"
                  : "text"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                loggedIn
                  ? "Enter command..."
                  : registerStep || loginStep
                  ? `Enter your ${registerStep || loginStep}...`
                  : "Enter 'register' or 'login'..."
              }
              disabled={!connected}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit(e);
                }
              }}
            />
            <button type="submit" disabled={!connected}>
              Send
            </button>
          </div>
          <div className="connection-status">
            Status: {connected ? "Connected" : "Disconnected"}
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
