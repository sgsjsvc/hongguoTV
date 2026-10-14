package com.hongguotv.tv.ui

import android.content.Context
import android.graphics.Color
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.hongguotv.tv.HistorySync
import com.hongguotv.tv.R
import com.hongguotv.tv.TvStore
import com.hongguotv.tv.TvUi

internal class SettingsScreenView(
    context: Context,
    val history: HistorySync,
    val store: TvStore,
    private val onConnectClick: (String, String, TextView) -> Unit,
    private val onDisableSyncClick: (EditText, EditText, TextView) -> Unit,
    private val onChooseModeClick: () -> Unit,
    private val onResetPreferencesClick: () -> Unit
) : ScrollView(context) {

    val urlInput: EditText
    val keyInput: EditText
    val statusText: TextView

    init {
        isFillViewport = true

        val column = TvUi.column(context).apply {
            setBackgroundColor(TvUi.BACKGROUND)
            val padH = TvUi.dimen(context, R.dimen.search_page_pad_h)
            val padV = TvUi.dimen(context, R.dimen.search_page_pad_v)
            setPadding(padH, padV, padH, padV)
        }

        column.addView(TvUi.title(context, "远程共享与同步"))
        column.addView(TvUi.text(context, "电视已内置内容服务。未配置远程时，收藏、历史和播放偏好保存在本机。", 16f).apply {
            setTextColor(TvUi.TEXT_MUTED)
        })

        val settingsPadH = TvUi.dimen(context, R.dimen.settings_input_pad_h)
        val settingsPadV = TvUi.dimen(context, R.dimen.settings_input_pad_v)
        val settingsHeight = TvUi.dimen(context, R.dimen.settings_input_height)
        val settingsMarginTop = TvUi.dimen(context, R.dimen.settings_input_margin_top)
        val settingsMarginBottom = TvUi.dimen(context, R.dimen.settings_input_margin_bottom)

        urlInput = EditText(context).apply {
            setText(history.remoteUrl)
            hint = "https://远程共享服务器"
            textSize = 20f
            setTextColor(Color.WHITE)
            isSingleLine = true
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI
            background = TvUi.surface(TvUi.PANEL, TvUi.BORDER_SUBTLE, radius = 18f)
            setPadding(settingsPadH, settingsPadV, settingsPadH, settingsPadV)
        }
        column.addView(urlInput, LinearLayout.LayoutParams(-1, settingsHeight).apply {
            topMargin = settingsMarginTop
            bottomMargin = settingsMarginBottom
        })

        keyInput = EditText(context).apply {
            setText(history.remoteKey)
            hint = "家庭共享密钥"
            textSize = 20f
            setTextColor(Color.WHITE)
            isSingleLine = true
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            background = TvUi.surface(TvUi.PANEL, TvUi.BORDER_SUBTLE, radius = 18f)
            setPadding(settingsPadH, settingsPadV, settingsPadH, settingsPadV)
        }
        column.addView(keyInput, LinearLayout.LayoutParams(-1, settingsHeight).apply {
            bottomMargin = settingsMarginBottom
        })

        statusText = TvUi.text(context, history.status, 14f).apply {
            setTextColor(TvUi.TEXT_MUTED)
        }

        val connectBtn = TvUi.pillButton(context, "验证并开启同步", active = true) {
            onConnectClick(urlInput.text.toString(), keyInput.text.toString(), statusText)
        }
        column.addView(connectBtn)

        val disableBtn = TvUi.pillButton(context, "取消远程同步") {
            onDisableSyncClick(urlInput, keyInput, statusText)
        }
        column.addView(disableBtn)

        val modeNames = arrayOf("混合推荐", "真人剧", "漫剧", "AI剧")
        val modes = listOf("mixed", "real-drama", "comic-drama", "ai-drama")
        val currentModeLabel = modeNames[modes.indexOf(store.recommendationMode).coerceAtLeast(0)]
        val modeBtn = TvUi.pillButton(context, "推荐内容：$currentModeLabel") {
            onChooseModeClick()
        }
        column.addView(modeBtn)

        val resetBtn = TvUi.pillButton(context, "重置推荐偏好") {
            onResetPreferencesClick()
        }
        column.addView(resetBtn)

        column.addView(statusText)

        addView(column, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }
}
