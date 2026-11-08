package io.github.flyboyhigh777.speedmeter.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.core.content.getSystemService

/** How the device is currently connected, as far as the platform will say without extra permissions. */
enum class ConnectionType { WIFI, CELLULAR, ETHERNET, VPN, OTHER, OFFLINE }

/**
 * Reports the active transport.
 *
 * Only [android.Manifest.permission.ACCESS_NETWORK_STATE] is used. The app deliberately does not
 * ask for location or phone-state permissions: the carrier name and the cell the device is on are
 * not needed to measure a link, and a speed test is not a reason to hand over where someone is.
 */
class NetworkStatusProvider(private val context: Context) {

    fun current(): ConnectionType {
        val manager = context.getSystemService<ConnectivityManager>() ?: return ConnectionType.OTHER
        val network = manager.activeNetwork ?: return ConnectionType.OFFLINE
        val capabilities = manager.getNetworkCapabilities(network) ?: return ConnectionType.OFFLINE

        return when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> ConnectionType.VPN
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> ConnectionType.WIFI
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> ConnectionType.CELLULAR
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> ConnectionType.ETHERNET
            else -> ConnectionType.OTHER
        }
    }
}
