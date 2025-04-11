import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getAuth,
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
    clan: "", // Add clan to registration data
  });
  const [loginStep, setLoginStep] = useState(null); // Track login step
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useCallback(
    async (data) => {
      console.log("Received create_user event with data:", data);
      try {
        const { email, password, characterName, clan } = registerData;
        console.log("Creating user with email:", email);
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const idToken = await userCredential.user.getIdToken();
        console.log(
          "User created successfully, emitting complete_registration"
        );
        socketRef.current.emit("complete_registration", {
          idToken,
          characterName,
          clan,
        });
      } catch (error) {
        console.error("Error creating user:", error);
        setMessages((prevMessages) => [
          ...prevMessages,
          "Registration failed: " + error.message,
        ]);
        setRegisterStep(null);
        setRegisterData({
          email: "",
          password: "",
          characterName: "",
          clan: "",
        });
      }
    },
    [registerData]
  );

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
      if (message === "You are already logged in from another session.") {
        setLoggedIn(false);
        setLoginStep(null);
      }
    });

    socket.on("registration_complete", (data) => {
      setMessages((prevMessages) => [...prevMessages, data.message]);
      setRegisterStep(null);
    });

    socket.on("registration_error", (data) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        "Registration failed: " + data.message,
        "Please try registering again.",
      ]);
      setRegisterStep(null);
      setRegisterData({
        email: "",
        password: "",
        characterName: "",
        clan: "",
      });
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

  // Separate useEffect for create_user event
  useEffect(() => {
    if (!socketRef.current) return;

    const handleCreateUser = async (data) => {
      console.log("Received create_user event with data:", data);
      try {
        const { email, password, characterName, clan } = registerData;
        console.log("Creating user with email:", email);
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const idToken = await userCredential.user.getIdToken();
        console.log(
          "User created successfully, emitting complete_registration"
        );
        socketRef.current.emit("complete_registration", {
          idToken,
          characterName,
          clan,
        });
      } catch (error) {
        console.error("Error creating user:", error);
        setMessages((prevMessages) => [
          ...prevMessages,
          "Registration failed: " + error.message,
        ]);
        setRegisterStep(null);
        setRegisterData({
          email: "",
          password: "",
          characterName: "",
          clan: "",
        });
      }
    };

    socketRef.current.on("create_user", handleCreateUser);

    return () => {
      socketRef.current.off("create_user", handleCreateUser);
    };
  }, [registerData]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;

    console.log("Current registerStep:", registerStep);
    console.log("Current input:", input);

    if (registerStep) {
      console.log("Handling registration step:", registerStep);
      switch (registerStep) {
        case "email":
          console.log("Setting email:", input);
          setRegisterData({ ...registerData, email: input });
          setRegisterStep("password");
          setMessages((prevMessages) => [
            ...prevMessages,
            "Type your password",
          ]);
          break;
        case "password":
          console.log("Setting password");
          setRegisterData({ ...registerData, password: input });
          setRegisterStep("characterName");
          setMessages((prevMessages) => [
            ...prevMessages,
            "Name your character",
          ]);
          break;
        case "characterName":
          console.log("Setting character name:", input);
          setRegisterData({ ...registerData, characterName: input });
          setRegisterStep("clan");
          setMessages((prevMessages) => [
            ...prevMessages,
            "Choose your clan: Yellow Dog, Red Bird, Green Frog, or Blue Flower",
          ]);
          break;
        case "clan":
          const validClans = [
            "Yellow Dog",
            "Red Bird",
            "Green Frog",
            "Blue Flower",
          ];
          if (!validClans.includes(input)) {
            setMessages((prevMessages) => [
              ...prevMessages,
              "Invalid clan. Please choose: Yellow Dog, Red Bird, Green Frog, or Blue Flower",
            ]);
            break;
          }
          console.log("Setting clan:", input);
          const updatedRegisterData = { ...registerData, clan: input };
          setRegisterData(updatedRegisterData);
          console.log(
            "Emitting initiate_registration with data:",
            updatedRegisterData
          );
          socketRef.current.emit("initiate_registration", updatedRegisterData);
          setMessages((prevMessages) => [
            ...prevMessages,
            "Processing registration...",
          ]);
          setRegisterStep(null);
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
            // Temporarily set a flag to track login success
            let loginSuccess = true;
            // Listen for server response
            socketRef.current.once("message", (message) => {
              if (
                message === "You are already logged in from another session."
              ) {
                loginSuccess = false;
                setLoggedIn(false);
                setLoginStep(null);
              }
            });
            // Wait for a short period to receive the server response
            setTimeout(() => {
              if (loginSuccess) {
                setLoggedIn(true);
                setLoginStep(null);
              }
            }, 500); // Adjust the timeout as needed
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
        setMessages((prevMessages) => [...prevMessages, "Type your email"]);
      } else if (input.toLowerCase() === "login") {
        setLoginStep("email");
        setMessages((prevMessages) => [...prevMessages, "Type your email"]);
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
