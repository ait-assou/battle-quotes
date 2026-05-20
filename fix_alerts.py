import re

with open('App.js', 'r') as f:
    content = f.read()

# 1. Update alertConfig state
content = content.replace(
    "const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });",
    "const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', buttons: [] });"
)

content = content.replace(
    """  const showAlert = (title, message) => {
    setAlertConfig({ visible: true, title, message });
  };""",
    """  const showAlert = (title, message, buttons = [{ text: 'OK' }]) => {
    setAlertConfig({ visible: true, title, message, buttons });
  };"""
)

# 2. Update CustomAlertModal rendering in App.js
content = content.replace(
    """          <CustomAlertModal
            visible={alertConfig.visible}
            title={alertConfig.title}
            message={alertConfig.message}
            onClose={hideAlert}
          />""",
    """          <CustomAlertModal
            visible={alertConfig.visible}
            title={alertConfig.title}
            message={alertConfig.message}
            buttons={alertConfig.buttons}
            onClose={hideAlert}
          />"""
)

# 3. Fix line 1334 Alert.alert (Confirmer Quote)
old_confirm = """    Alert.alert(
      'Confirmer',
      `Voulez-vous définir cette citation comme Quote ${slot === 'q1' ? '1 (Rouge)' : '2 (Jaune)'} ?\\n\\n"${quoteText}"\\n— ${authorText || 'ANONYME'}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'VALIDER',
          onPress: () => {
            onSetQuote(quoteText, authorText, slot);
            setNewQuoteText(""); // clear input
            setNewQuoteAuthor("");
            showAlert('Succès', `La citation a été définie pour la Quote ${slot === 'q1' ? '1' : '2'} !`);
          }
        }
      ]
    );"""
new_confirm = old_confirm.replace("Alert.alert(", "showAlert(")
content = content.replace(old_confirm, new_confirm)

# 4. Fix line 1371 Alert.alert (Déconnexion)
old_logout = """                    Alert.alert(
                      "Déconnexion",
                      "Voulez-vous vous déconnecter du panel Admin ?",
                      [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: "Déconnexion",
                          style: "destructive",
                          onPress: async () => {
                            await supabase.auth.signOut();
                            onClose();
                            showAlert("Déconnecté", "Vous avez été déconnecté avec succès.");
                          }
                        }
                      ]
                    );"""
new_logout = old_logout.replace("Alert.alert(", "showAlert(")
content = content.replace(old_logout, new_logout)

# 5. Rewrite CustomAlertModal component
old_modal = """function CustomAlertModal({ visible, title, message, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { padding: 25, maxWidth: 350, borderWidth: 2, borderColor: '#ff3b30' }]}>
          <Text style={[modalStyles.title, { fontSize: 24, marginBottom: 15, color: '#ff3b30' }]}>{title}</Text>
          <Text style={[modalStyles.description, { color: '#ccc', fontSize: 16, lineHeight: 22 }]}>{message}</Text>
          
          <TouchableOpacity 
            style={[modalStyles.button, { marginTop: 10, width: '100%', alignSelf: 'center' }]} 
            onPress={onClose}
          >
            <Text style={modalStyles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}"""

new_modal = """function CustomAlertModal({ visible, title, message, buttons, onClose }) {
  const renderedButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { padding: 25, maxWidth: 350, borderWidth: 2, borderColor: '#ff3b30' }]}>
          <Text style={[modalStyles.title, { fontSize: 24, marginBottom: 15, color: '#ff3b30' }]}>{title}</Text>
          <Text style={[modalStyles.description, { color: '#ccc', fontSize: 16, lineHeight: 22 }]}>{message}</Text>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 }}>
            {renderedButtons.map((btn, idx) => (
              <TouchableOpacity 
                key={idx}
                style={[
                  modalStyles.button, 
                  { 
                    flex: 1, 
                    marginHorizontal: 5,
                    backgroundColor: btn.style === 'cancel' ? '#333' : '#ff3b30'
                  }
                ]} 
                onPress={() => {
                  if (btn.onPress) btn.onPress();
                  onClose();
                }}
              >
                <Text style={[modalStyles.buttonText, { color: btn.style === 'cancel' ? '#ccc' : '#fff' }]}>{btn.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}"""
content = content.replace(old_modal, new_modal)

with open('App.js', 'w') as f:
    f.write(content)

print("Fixed Custom Alerts with buttons support!")
