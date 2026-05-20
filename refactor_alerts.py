import re

with open('App.js', 'r') as f:
    content = f.read()

# 1. Add alertConfig to App state
state_code = """  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });

  const showAlert = (title, message) => {
    setAlertConfig({ visible: true, title, message });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };
"""
content = content.replace(
    "  const [showNicknameModal, setShowNicknameModal] = useState(false);\n  const [isCalendarVisible, setIsCalendarVisible] = useState(false);",
    state_code
)

# 2. Pass showAlert to components in App.js render
content = content.replace("<BattleQuoteModal\n              visible={isModalVisible}", "<BattleQuoteModal\n              showAlert={showAlert}\n              visible={isModalVisible}")
content = content.replace("<OnboardingModal\n            visible={showOnboarding}", "<OnboardingModal\n            showAlert={showAlert}\n            visible={showOnboarding}")
content = content.replace("<NicknameModal\n            visible={showNicknameModal}", "<NicknameModal\n            showAlert={showAlert}\n            visible={showNicknameModal}")
content = content.replace("<AdminSettingsModal\n            visible={isAdminVisible}", "<AdminSettingsModal\n            showAlert={showAlert}\n            visible={isAdminVisible}")
content = content.replace("<LoginModal\n            visible={isLoginVisible}", "<LoginModal\n            showAlert={showAlert}\n            visible={isLoginVisible}")
content = content.replace("<CalendarModal \n            visible={isCalendarVisible}", "<CalendarModal \n            showAlert={showAlert}\n            visible={isCalendarVisible}")

# 3. Add CustomAlertModal to App.js render right before <StatusBar />
alert_render = """          <CustomAlertModal
            visible={alertConfig.visible}
            title={alertConfig.title}
            message={alertConfig.message}
            onClose={hideAlert}
          />
        </SafeAreaView>"""
content = content.replace("        </SafeAreaView>", alert_render)

# 4. Add showAlert to component signatures
content = content.replace("function LoginModal({ visible, onClose }) {", "function LoginModal({ visible, onClose, showAlert }) {")
content = content.replace("function AdminSettingsModal({ visible, onClose, onSetQuote, activeQuotes, votes }) {", "function AdminSettingsModal({ visible, onClose, onSetQuote, activeQuotes, votes, showAlert }) {")
content = content.replace("function OnboardingModal({ visible, onClose }) {", "function OnboardingModal({ visible, onClose, showAlert }) {")
content = content.replace("function BattleQuoteModal({ visible, onClose, onSubmit, results, nickname }) {", "function BattleQuoteModal({ visible, onClose, onSubmit, results, nickname, showAlert }) {")
content = content.replace("function NicknameModal({ visible, onSubmit }) {", "function NicknameModal({ visible, onSubmit, showAlert }) {")
content = content.replace("function CalendarModal({ visible, onClose }) {", "function CalendarModal({ visible, onClose, showAlert }) {")

# 5. Replace Alert.alert calls with showAlert
# Note: showAlert in App doesn't need 'this.', it's in scope for submitCustomQuote, handleSaveNickname, handleSetQuote
content = re.sub(r'Alert\.alert\((.*?)\)', r'showAlert(\1)', content)

# 6. Append CustomAlertModal definition at the end
custom_alert_def = """

function CustomAlertModal({ visible, title, message, onClose }) {
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
}
"""
content += custom_alert_def

with open('App.js', 'w') as f:
    f.write(content)

print("Refactored App.js successfully!")
