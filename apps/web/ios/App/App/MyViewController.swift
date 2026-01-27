import UIKit
import Capacitor

class MyViewController: CAPBridgeViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Disable bounce/overscroll on the WebView
        if let scrollView = webView?.scrollView {
            scrollView.bounces = false
            scrollView.alwaysBounceVertical = false
            scrollView.alwaysBounceHorizontal = false
            
            // Set background color to match app gradient
            scrollView.backgroundColor = UIColor(red: 248/255, green: 250/255, blue: 252/255, alpha: 1.0)
        }
        
        // Set WebView background color
        webView?.backgroundColor = UIColor(red: 248/255, green: 250/255, blue: 252/255, alpha: 1.0)
        webView?.isOpaque = false
    }
}
