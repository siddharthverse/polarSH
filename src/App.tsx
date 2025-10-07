import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PaymentPage from './components/PaymentPage';
import ConfirmationPage from './components/ConfirmationPage';
import PurchasesPage from './components/PurchasesPage';

function App() {
  const handlePaymentInitiated = () => {
    // Optional callback for analytics or state management
    console.log('Payment initiated - redirecting to Polar SH checkout');
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<PaymentPage onPaymentInitiated={handlePaymentInitiated} />} />
        <Route path="/confirmation" element={<ConfirmationPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
      </Routes>
    </Router>
  );
}

export default App;
